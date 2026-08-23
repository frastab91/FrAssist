import type { LogEvent } from '../types';

type LogSidebarProps = {
  logs: LogEvent[];
  setLogs: (logs: LogEvent[]) => void;
  logsEndRef: React.RefObject<HTMLDivElement | null>;
};

export function LogSidebar({ logs, setLogs, logsEndRef }: LogSidebarProps) {
  return (
    <aside className="log-sidebar" style={{ width: '360px', borderLeft: '1px solid #1e293b', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      <div className="log-header" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>⬤ Live Log Stream</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', color: '#34d399' }}>{logs.length} events</span>
          <button onClick={() => setLogs([])} style={{ fontSize: '0.7rem', cursor: 'pointer', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '4px', padding: '2px 8px' }}>Clear</button>
        </div>
      </div>
      <div className="log-list" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '3px', background: '#0f172a' }}>
        {logs.map(log => {
          const TYPE_COLOR: Record<string, string> = {
            tool_start: '#a78bfa',
            tool_result: '#34d399',
            tool_error: '#f87171',
            tool_call: '#a78bfa',
            tool_output: '#94a3b8',
            api_request: '#60a5fa',
            api_response: '#22d3ee',
            system: '#94a3b8',
            error: '#f87171',
            warning: '#fbbf24',
          };
          const accentColor = log.level === 'error' ? '#f87171'
            : log.level === 'warning' ? '#fbbf24'
            : (TYPE_COLOR[log.type] || '#60a5fa');
          const isTerminal = log.type === 'tool_output';
          return (
            <div key={log.id} style={{
              fontSize: '0.72rem',
              padding: isTerminal ? '0.35rem 0.6rem' : '0.45rem 0.6rem',
              background: isTerminal ? '#020617' : '#1e293b',
              borderRadius: '5px',
              borderLeft: `3px solid ${accentColor}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: isTerminal ? 0 : '0.2rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#475569', fontSize: '0.62rem', fontFamily: 'monospace', flexShrink: 0 }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span style={{
                  fontSize: '0.58rem',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: accentColor + '25',
                  color: accentColor,
                  fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>{log.type}</span>
                {log.agentId && log.agentId !== 'system' && (
                  <span style={{ fontSize: '0.6rem', color: '#64748b', flexShrink: 0 }}>[{log.agentId}]</span>
                )}
              </div>
              <div style={{
                color: isTerminal ? '#86efac' : '#cbd5e1',
                fontFamily: isTerminal ? 'monospace' : 'inherit',
                whiteSpace: isTerminal ? 'pre-wrap' : 'normal',
                wordBreak: 'break-all' as const,
                lineHeight: 1.45,
              }}>{log.message}</div>
              {log.data && !isTerminal && log.type !== 'tool_start' && (
                <pre style={{
                  marginTop: '0.3rem',
                  padding: '0.35rem',
                  background: '#0f172a',
                  borderRadius: '3px',
                  overflowX: 'auto',
                  fontSize: '0.62rem',
                  color: '#64748b',
                }}>{JSON.stringify(log.data, null, 2)}</pre>
              )}
            </div>
          );
        })}
        <div ref={logsEndRef} />
      </div>
    </aside>
  );
}
