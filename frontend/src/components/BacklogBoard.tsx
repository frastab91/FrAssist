import React, { useState, useEffect, useRef } from 'react';
import { Play, Terminal, X, Code, Box, AlertCircle } from 'lucide-react';

export function BacklogBoard({ socket }: { socket: any }) {
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Execution Modal State
  const [executingTask, setExecutingTask] = useState<any | null>(null);
  const [executionLogs, setExecutionLogs] = useState<{ type: string, text: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBacklog();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('agy_execution_log', (data: { taskId: string, type: string, chunk?: string, code?: number }) => {
        if (executingTask && executingTask.id === data.taskId) {
          if (data.type === 'stdout' || data.type === 'stderr') {
            setExecutionLogs(prev => [...prev, { type: data.type, text: data.chunk || '' }]);
          } else if (data.type === 'close') {
            setExecutionLogs(prev => [...prev, { type: 'system', text: `\n[Process exited with code ${data.code}]\n` }]);
          }
        }
      });
    }
    return () => {
      if (socket) socket.off('agy_execution_log');
    };
  }, [socket, executingTask]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executionLogs]);

  const fetchBacklog = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/backlog');
      const data = await res.json();
      setColumns(data.columns || []);
    } catch (err) {
      console.error('Failed to fetch backlog', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (task: any) => {
    setExecutingTask(task);
    setExecutionLogs([{ type: 'system', text: `Starting Antigravity CLI for task: ${task.id}...\n\n` }]);
    try {
      await fetch('/api/backlog/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          project: task.project,
          prompt: task.prompt
        })
      });
    } catch (err) {
      setExecutionLogs(prev => [...prev, { type: 'stderr', text: `Failed to start execution: ${String(err)}` }]);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-[#A1A1AA]">Loading Backlog...</div>;
  }

  return (
    <div className="flex-1 overflow-x-auto p-6 bg-[#09090B] text-white">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Box className="text-[#3b82f6]" /> Scrum & Product Backlog
        </h1>
        <button onClick={fetchBacklog} className="text-xs bg-[#27272A] hover:bg-[#3F3F46] px-3 py-1.5 rounded transition-colors">
          Refresh Board
        </button>
      </div>

      <div className="flex gap-6 h-full min-h-[500px]">
        {columns.map((col, idx) => (
          <div key={idx} className="flex-shrink-0 w-[350px] flex flex-col bg-[#18181B] rounded-xl border border-[#27272A] overflow-hidden">
            <div className="p-4 border-b border-[#27272A] font-semibold text-[#E4E4E7] bg-[#27272A]/30">
              {col.title} <span className="text-xs text-[#A1A1AA] font-normal ml-2">({col.tasks.length})</span>
            </div>
            
            <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3">
              {col.tasks.length === 0 ? (
                <div className="text-center p-6 text-sm text-[#52525B] italic">No tasks here</div>
              ) : (
                col.tasks.map((task: any, tIdx: number) => (
                  <div key={tIdx} className="bg-[#27272A] border border-[#3F3F46] p-4 rounded-lg shadow-sm hover:border-[#52525B] transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded">{task.id}</span>
                      {task.priority && (
                        <span className="text-xs font-bold text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded">{task.priority}</span>
                      )}
                    </div>
                    
                    <h3 className="font-medium text-[#F4F4F5] text-sm leading-snug mb-3">{task.title}</h3>
                    
                    <div className="flex flex-wrap gap-2 text-xs mb-4">
                      {task.project && (
                        <span className="bg-[#18181B] px-2 py-1 rounded text-[#D4D4D8] border border-[#3F3F46] flex items-center gap-1">
                          <Code size={12} /> {task.project}
                        </span>
                      )}
                      {task.type && (
                        <span className="bg-[#18181B] px-2 py-1 rounded text-[#A1A1AA]">{task.type}</span>
                      )}
                      {task.complexity && (
                        <span className="bg-[#18181B] px-2 py-1 rounded text-[#A1A1AA]">Complexity: {task.complexity}</span>
                      )}
                    </div>

                    {task.prompt ? (
                      <button 
                        onClick={() => handleExecute(task)}
                        className="w-full mt-2 flex items-center justify-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white py-1.5 px-3 rounded text-sm font-medium transition-colors"
                      >
                        <Play size={14} /> Execute via AGY
                      </button>
                    ) : (
                      <div className="w-full mt-2 flex items-center justify-center gap-2 bg-[#18181B] text-[#52525B] border border-[#27272A] py-1.5 px-3 rounded text-sm cursor-not-allowed">
                        <AlertCircle size={14} /> Needs Dev Prompt
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Execution Terminal Modal */}
      {executingTask && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm">
          <div className="w-full max-w-5xl h-[80vh] bg-[#09090B] border border-[#27272A] rounded-xl overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-[#27272A] bg-[#18181B]">
              <div className="flex items-center gap-3">
                <Terminal className="text-[#3b82f6]" size={20} />
                <h2 className="font-semibold text-[#E4E4E7]">Antigravity CLI: {executingTask.id}</h2>
                <span className="text-xs font-mono text-[#A1A1AA] bg-[#27272A] px-2 py-1 rounded">{executingTask.project}</span>
              </div>
              <button onClick={() => setExecutingTask(null)} className="text-[#A1A1AA] hover:text-white p-1 rounded hover:bg-[#27272A] transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 bg-black p-4 overflow-y-auto font-mono text-sm">
              {executionLogs.map((log, i) => (
                <span key={i} className={
                  log.type === 'stderr' ? 'text-rose-400' : 
                  log.type === 'system' ? 'text-amber-400' : 
                  'text-[#A1A1AA]'
                }>
                  {log.text}
                </span>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
