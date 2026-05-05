import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { testRunsApi } from '../../api/test-runs';
import type {
  EvaluatorFixtureResultDto,
  OutputValueDto,
  RuntimeBreakdownDto,
  EndpointUsageDto,
} from '../../api/models';
import { fmtDuration, fmtTokens } from '../../lib/format';

interface Props {
  runId: string;
  caseId: string;
  caseIdx?: number;
  total?: number;
  caseSummary?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const ROLE_COLOR: Record<string, string> = {
  system: '#c9944a',
  user: '#6b9eaa',
  assistant: '#3daa6f',
  tool: '#888',
};

function outputStr(val: OutputValueDto): string {
  if (val.kind === 'message') return val.content ?? '';
  if (val.kind === 'tool_call') return JSON.stringify({ tool: val.tool, arguments: val.arguments }, null, 2);
  return JSON.stringify(val, null, 2);
}

function OutputBlock({ label, color, value }: { label: string; color: string; value: OutputValueDto }) {
  const text = outputStr(value);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        {value.kind === 'tool_call' && (
          <span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(201,148,74,0.12)', color: '#c9944a', fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace" }}>tool_call</span>
        )}
      </div>
      <div style={{
        background: 'rgba(0,0,0,0.18)', borderRadius: 8,
        border: `1px solid ${color}22`,
        padding: '10px 12px',
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 11.5, lineHeight: 1.65,
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 160, overflowY: 'auto',
      }}>
        {text || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(empty)</span>}
      </div>
    </div>
  );
}

function EvaluatorPanel({ ev }: { ev: EvaluatorFixtureResultDto }) {
  return (
    <div style={{
      background: 'var(--bg-card-2)',
      borderRadius: 10,
      overflow: 'hidden',
      borderLeft: `3px solid ${ev.color}`,
    }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          padding: '2px 7px', borderRadius: 100, fontSize: 10, fontWeight: 600,
          background: `${ev.color}20`, color: ev.color,
        }}>{ev.evaluatorKind}</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{ev.evaluatorName}</span>
        {typeof ev.score === 'number' && (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-secondary)' }}>
            {(ev.score * 100).toFixed(0)}%
          </span>
        )}
        <span style={{
          padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
          background: ev.pass ? 'rgba(61,170,111,0.12)' : 'rgba(217,85,85,0.12)',
          color: ev.pass ? '#3daa6f' : '#d95555',
        }}>{ev.pass ? '✓ Pass' : '✗ Fail'}</span>
      </div>
      {ev.note && (
        <div style={{ padding: '0 14px 10px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{ev.note}</div>
      )}
      {ev.breakdown.length > 0 && (
        <div style={{ borderTop: '1px solid var(--hairline)', padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '6px 14px', alignItems: 'center' }}>
          {ev.breakdown.map((b, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.k}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>{b.v}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: b.match ? '#3daa6f' : '#d95555', textAlign: 'right' }}>{b.match ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const RUNTIME_SEGMENTS: { key: keyof RuntimeBreakdownDto; label: string; color: string }[] = [
  { key: 'ttft', label: 'TTFT', color: '#6b9eaa' },
  { key: 'gen', label: 'Gen', color: '#c9944a' },
  { key: 'tools', label: 'Tools', color: '#3daa6f' },
  { key: 'judge', label: 'Judge', color: '#c2836b' },
];

function RuntimePanel({ runtime }: { runtime: RuntimeBreakdownDto }) {
  const segments = RUNTIME_SEGMENTS.filter(s => (runtime[s.key] as number | null | undefined) != null && (runtime[s.key] as number) > 0);
  const total = runtime.total || segments.reduce((acc, s) => acc + ((runtime[s.key] as number) ?? 0), 0);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Runtime</div>
      <div style={{ display: 'flex', height: 5, borderRadius: 100, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', marginBottom: 10 }}>
        {segments.map(s => (
          <div
            key={s.key}
            style={{ width: `${(((runtime[s.key] as number) ?? 0) / total * 100).toFixed(1)}%`, background: s.color }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {segments.map(s => (
          <div key={s.key} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
            background: `${s.color}14`, border: `1px solid ${s.color}33`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: s.color, fontWeight: 600 }}>
              {fmtDuration((runtime[s.key] as number) ?? 0)}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Total</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{fmtDuration(total)}</span>
        </div>
      </div>
    </div>
  );
}

function CostPanel({ endpoints }: { endpoints: EndpointUsageDto[] }) {
  const totalCost = endpoints.reduce((s, ep) => s + ep.costUsd, 0);
  const totalTok = endpoints.reduce((s, ep) => s + ep.tokIn + ep.tokOut, 0);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cost</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>${totalCost.toFixed(4)}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtTokens(totalTok)} tok</div>
      </div>
      {totalCost > 0 && (
        <div style={{ display: 'flex', height: 4, borderRadius: 100, overflow: 'hidden', marginBottom: 10 }}>
          {endpoints.map(ep => (
            <div
              key={ep.id}
              style={{ width: `${(ep.costUsd / totalCost * 100).toFixed(1)}%`, background: ep.color }}
              title={ep.label}
            />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {endpoints.map(ep => (
          <div key={ep.id} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12,
            padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.14)', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ep.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.label}</span>
              {ep.region && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '1px 5px', background: 'var(--bg-card-2)', borderRadius: 4, flexShrink: 0 }}>{ep.region}</span>
              )}
            </div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {fmtTokens(ep.tokIn)}→{fmtTokens(ep.tokOut)}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>{ep.calls}×</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
              ${ep.costUsd.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FixtureDrawer({ runId, caseId, caseIdx, total: totalCases, caseSummary, onClose, onPrev, onNext }: Props) {
  const { data: fixture, isLoading } = useQuery({
    queryKey: ['fixture', runId, caseId],
    queryFn: () => testRunsApi.getFixture(runId, caseId),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  const passed = fixture?.evaluators.filter(e => e.pass).length ?? 0;
  const evalTotal = fixture?.evaluators.length ?? 0;
  const isPass = evalTotal > 0 && passed === evalTotal;
  const compositeScore = evalTotal > 0 ? Math.round(passed / evalTotal * 100) : null;
  const totalCost = fixture?.endpoints.reduce((s, ep) => s + ep.costUsd, 0) ?? 0;
  const totalTokens = fixture?.endpoints.reduce((s, ep) => s + ep.tokIn + ep.tokOut, 0) ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 49 }} onClick={onClose} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100%',
        width: 720, maxWidth: '95vw',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-float)',
        zIndex: 50,
        display: 'flex', flexDirection: 'column',
        animation: 'fade-up 0.18s ease both',
      }}>
        {/* ── Sticky header ── */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}>
          {/* Pass/fail dot */}
          {fixture && (
            <span style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: isPass ? '#3daa6f' : '#d95555',
              boxShadow: `0 0 8px ${isPass ? '#3daa6f' : '#d95555'}88`,
            }} />
          )}

          {/* Case ID + name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-muted)',
                background: 'var(--bg-card-2)', padding: '1px 6px', borderRadius: 4, flexShrink: 0,
              }}>
                {caseId.slice(0, 8)}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {caseSummary ?? 'Test Case'}
              </span>
            </div>
          </div>

          {/* PASS/FAIL pill */}
          {fixture && (
            <span style={{
              padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0,
              background: isPass ? 'rgba(61,170,111,0.12)' : 'rgba(217,85,85,0.12)',
              color: isPass ? '#3daa6f' : '#d95555',
            }}>{isPass ? 'PASS' : 'FAIL'}</span>
          )}

          {/* Index counter */}
          {caseIdx != null && totalCases != null && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>
              {caseIdx + 1}/{totalCases}
            </span>
          )}

          {/* Nav arrows */}
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <button
              onClick={onPrev} disabled={!onPrev}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)', fontSize: 13,
                opacity: onPrev ? 1 : 0.3, cursor: onPrev ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >←</button>
            <button
              onClick={onNext} disabled={!onNext}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)', fontSize: 13,
                opacity: onNext ? 1 : 0.3, cursor: onNext ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >→</button>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 6, fontSize: 14, flexShrink: 0 }}
          >✕</button>
        </div>

        {/* ── Metric band ── */}
        {fixture && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            borderBottom: '1px solid var(--hairline)', flexShrink: 0,
          }}>
            {[
              {
                label: 'Composite score',
                value: compositeScore != null ? `${compositeScore}%` : '—',
                sub: `${passed}/${evalTotal} evaluators`,
                color: compositeScore != null && compositeScore >= 80 ? '#3daa6f' : compositeScore != null && compositeScore >= 50 ? '#d4915c' : '#d95555',
              },
              {
                label: 'Runtime',
                value: fmtDuration(fixture.runtime.total),
                sub: undefined,
                color: 'var(--text-primary)',
              },
              {
                label: 'Cost',
                value: `$${totalCost.toFixed(4)}`,
                sub: undefined,
                color: 'var(--text-primary)',
              },
              {
                label: 'Tokens',
                value: fmtTokens(totalTokens),
                sub: undefined,
                color: 'var(--text-primary)',
              },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '12px 16px',
                borderRight: i < 3 ? '1px solid var(--hairline)' : 'none',
              }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: m.color }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {isLoading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 40 }}>Loading…</div>
          )}

          {fixture && (
            <>
              {/* ── Input messages ── */}
              <section>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Input</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fixture.input.messages.map((m, i) => {
                    const roleColor = ROLE_COLOR[m.role.toLowerCase()] ?? 'var(--text-muted)';
                    return (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '72px 1fr', gap: 10,
                        padding: '10px 12px', borderRadius: 8, background: 'var(--bg-card-2)',
                        borderLeft: `3px solid ${roleColor}`,
                      }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 1 }}>
                          {m.role}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.content}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Expected vs Actual ── */}
              <section>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Output</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <OutputBlock label="Expected" color="#6b9eaa" value={fixture.expected} />
                  <OutputBlock label="Actual" color="#3daa6f" value={fixture.actual} />
                </div>
              </section>

              {/* ── Evaluator panels ── */}
              {fixture.evaluators.length > 0 && (
                <section>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                    Evaluations <span style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>({passed}/{evalTotal})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {fixture.evaluators.map((ev, i) => (
                      <EvaluatorPanel key={i} ev={ev} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Runtime + Cost side-by-side ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-card-2)' }}>
                  <RuntimePanel runtime={fixture.runtime} />
                </div>
                {fixture.endpoints.length > 0 && (
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-card-2)' }}>
                    <CostPanel endpoints={fixture.endpoints} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
