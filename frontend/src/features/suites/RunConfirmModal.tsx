import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { providersApi } from '../../api/providers';
import type { ModelEndpointDto, TestSuiteDto } from '../../api/models';
import { agentColor, modelColor } from '../../lib/colors';
import { QUERY_KEYS } from '../../api/query-keys';

export function RunConfirmModal({ suite, onClose, onSubmit, loading, done }: {
  suite: TestSuiteDto;
  onClose: () => void;
  onSubmit: (endpointIds: string[]) => void;
  loading: boolean;
  done: boolean;
}) {
  const navigate = useNavigate();
  const { data: modelsData = [] } = useQuery({ queryKey: QUERY_KEYS.modelEndpoints, queryFn: providersApi.getAllModels });
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());
  const c = agentColor(suite.agentId);

  function toggle(id: string) {
    setSelectedEndpoints(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const isMulti = selectedEndpoints.size > 1;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fade-up 0.18s ease-out' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, background: 'var(--bg-card)', borderRadius: 20, boxShadow: 'var(--shadow-float)', overflow: 'hidden' }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${c}, ${c}55)` }} />

        {done ? (
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--success-subtle)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--success)', fontSize: 24 }}>
              ✓
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{isMulti ? 'Parallel evaluation started' : 'Evaluation started'}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              Running <strong style={{ color: 'var(--text-primary)' }}>{suite.testCases.length} test cases</strong>
              {isMulti
                ? <> across <strong style={{ color: c }}>{selectedEndpoints.size} models</strong> in parallel</>
                : selectedEndpoints.size === 1
                  ? <> against <strong style={{ color: c }}>{[...modelsData].find((ep: ModelEndpointDto) => selectedEndpoints.has(ep.id))?.modelName ?? 'selected model'}</strong></>
                  : null
              }.
            </p>
            <button
              onClick={() => { navigate('/runs'); onClose(); }}
              style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#fff', boxShadow: '0 4px 14px -4px rgba(139,92,246,0.5)' }}
            >
              View Test Runs →
            </button>
          </div>
        ) : (
          <div style={{ padding: '24px 28px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Start new test run</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.55 }}>
              Run <strong style={{ color: 'var(--text-primary)' }}>{suite.testCases.length} test cases</strong> from <strong style={{ color: 'var(--text-primary)' }}>{suite.name}</strong> and compare results.
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                Model endpoints to evaluate
                {isMulti && (
                  <span style={{ padding: '2px 8px', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.12))', color: '#c4b5fd', borderRadius: 100, fontSize: 10, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                    Parallel · {selectedEndpoints.size} selected
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {modelsData.map((ep: ModelEndpointDto) => {
                  const mc = modelColor(ep.modelName);
                  const isOn = selectedEndpoints.has(ep.id);
                  return (
                    <button key={ep.id} onClick={() => toggle(ep.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, textAlign: 'left', background: isOn ? mc + '12' : 'var(--bg-card-2)', boxShadow: isOn ? `inset 0 0 0 1.5px ${mc}44` : 'var(--shadow-pill)', transition: 'all 0.12s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${isOn ? mc : 'var(--text-muted)'}`, background: isOn ? mc : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
                        {isOn && <span style={{ color: '#000', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, color: isOn ? mc : 'var(--text-secondary)', flex: 1 }}>{ep.modelName}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ep.providerName}</span>
                    </button>
                  );
                })}
                {modelsData.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
                    No endpoints configured. Add providers first.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '9px 18px', background: 'var(--bg-card-2)', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', boxShadow: 'var(--shadow-pill)' }}>Cancel</button>
              <button
                onClick={() => onSubmit(Array.from(selectedEndpoints))}
                disabled={loading || selectedEndpoints.size === 0}
                style={{ padding: '9px 20px', background: selectedEndpoints.size > 0 ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'var(--bg-card-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: selectedEndpoints.size > 0 ? '#fff' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: loading ? 0.7 : 1, transition: 'all 0.15s', boxShadow: selectedEndpoints.size > 0 ? '0 4px 14px -4px rgba(139,92,246,0.5)' : 'none' }}
              >
                {loading
                  ? <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'block' }} /> Running…</>
                  : <>▶ {isMulti ? `Run on ${selectedEndpoints.size} endpoints` : 'Start run'}</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
