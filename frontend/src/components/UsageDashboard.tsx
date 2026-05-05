import React, { useMemo } from 'react';
import { X, Brain, Activity, Zap, Database, TrendingUp } from 'lucide-react';
import type { DetailedStat, SystemStats } from '../types';

type UsageDashboardProps = {
  detailedStats: DetailedStat[];
  systemStats: SystemStats;
  onClose: () => void;
};

export function UsageDashboard({ detailedStats, systemStats, onClose }: UsageDashboardProps) {
  // Group stats by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, DetailedStat[]>();
    detailedStats.forEach(stat => {
      if (!map.has(stat.date)) map.set(stat.date, []);
      map.get(stat.date)!.push(stat);
    });
    return Array.from(map.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [detailedStats]);

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(2) + 'M';
    if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'k';
    return tokens.toString();
  };

  const maxTokensPerDay = useMemo(() => {
    let max = 0;
    groupedByDate.forEach(([_, stats]) => {
      const dayTotal = stats.reduce((sum, s) => sum + s.totalTokens, 0);
      if (dayTotal > max) max = dayTotal;
    });
    return max || 1; // Prevent division by zero
  }, [groupedByDate]);

  return (
    <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)' }}>
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%', background: '#0f172a', color: '#f8fafc', border: '1px solid #1e293b', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid #1e293b', padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '0.75rem', borderRadius: '12px' }}>
              <Activity size={24} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Usage Intelligence
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Comprehensive breakdown of token consumption and API requests.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '2rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Top Level KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '16px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <Zap size={16} /> Total Input
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{formatTokens(systemStats.total_input_tokens)}</div>
            </div>
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '16px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <Brain size={16} /> Total Output
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{formatTokens(systemStats.total_output_tokens)}</div>
            </div>
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '16px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <Database size={16} /> Total Requests
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{systemStats.total_requests}</div>
            </div>
          </div>

          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e2e8f0' }}>
            <TrendingUp size={18} /> Daily Consumption by Topic
          </h3>

          {groupedByDate.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
              No detailed usage data available yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {groupedByDate.map(([date, stats]) => {
                const dayTotal = stats.reduce((sum, s) => sum + s.totalTokens, 0);
                const dayWidth = (dayTotal / maxTokensPerDay) * 100;
                
                return (
                  <div key={date} style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>
                        <span style={{ color: '#e2e8f0' }}>{formatTokens(dayTotal)}</span> tokens total
                      </div>
                    </div>

                    {/* Day total bar */}
                    <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '3px', marginBottom: '1.5rem', overflow: 'hidden' }}>
                      <div style={{ width: `${dayWidth}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: '3px' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                      {stats.sort((a, b) => b.totalTokens - a.totalTokens).map((stat, idx) => {
                        const width = (stat.totalTokens / dayTotal) * 100;
                        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
                        const color = colors[idx % colors.length];

                        return (
                          <div key={stat.agentId} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '140px', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {stat.agentId}
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ flex: 1, height: '8px', background: '#0f172a', borderRadius: '4px', overflow: 'hidden', border: '1px solid #1e293b' }}>
                                <div style={{ width: `${width}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 1s ease-out' }} />
                              </div>
                              <div style={{ width: '80px', textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                {formatTokens(stat.totalTokens)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
