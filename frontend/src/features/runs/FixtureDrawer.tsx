import { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-[6px] mb-[7px]">
        <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.07em]">{label}</span>
        {value.kind === 'tool_call' && (
          <span className="px-[5px] py-[1px] rounded-[3px] text-[9.5px]" style={{ background: 'rgba(201,148,74,0.12)', color: '#c9944a', fontFamily: "'JetBrains Mono',monospace" }}>tool_call</span>
        )}
      </div>
      <div
        className="rounded-lg p-[10px_12px] max-h-[160px] overflow-y-auto font-mono text-[11.5px] leading-[1.65] text-primary whitespace-pre-wrap break-words bg-black/[0.18]"
        style={{ border: `1px solid ${color}22` }}
      >
        {text || <span className="text-muted italic">(empty)</span>}
      </div>
    </div>
  );
}

function EvaluatorPanel({ ev }: { ev: EvaluatorFixtureResultDto }) {
  return (
    <div className="bg-card-2 rounded-[10px] overflow-hidden" style={{ borderLeft: `3px solid ${ev.color}` }}>
      <div className="p-[10px_14px] flex items-center gap-2">
        <span className="px-[7px] py-[2px] rounded-full text-[10px] font-semibold" style={{ background: `${ev.color}20`, color: ev.color }}>{ev.evaluatorKind}</span>
        <span className="text-[13px] font-semibold flex-1">{ev.evaluatorName}</span>
        {typeof ev.score === 'number' && (
          <span className="font-mono text-[12px] text-secondary">
            {(ev.score * 100).toFixed(0)}%
          </span>
        )}
        <span
          className="px-2 py-[2px] rounded-[5px] text-[11px] font-bold"
          style={{
            background: ev.pass ? 'rgba(61,170,111,0.12)' : 'rgba(217,85,85,0.12)',
            color: ev.pass ? '#3daa6f' : '#d95555',
          }}
        >{ev.pass ? '✓ Pass' : '✗ Fail'}</span>
      </div>
      {ev.note && (
        <div className="px-[14px] pb-[10px] text-[12.5px] text-secondary leading-[1.55]">{ev.note}</div>
      )}
      {ev.breakdown.length > 0 && (
        <div className="border-t border-hairline p-[10px_14px] grid grid-cols-[1fr_auto_auto] items-center gap-[6px_14px]">
          {ev.breakdown.map((b, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <span className="text-[12px] text-muted">{b.k}</span>
              <span className="font-mono text-[11px] text-secondary text-right">{b.v}</span>
              <span className="text-[11px] font-bold text-right" style={{ color: b.match ? '#3daa6f' : '#d95555' }}>{b.match ? '✓' : '✗'}</span>
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
      <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.07em] mb-[10px]">Runtime</div>
      <div className="flex h-[5px] rounded-full overflow-hidden mb-[10px] bg-white/[0.04]">
        {segments.map(s => (
          <div
            key={s.key}
            style={{ width: `${(((runtime[s.key] as number) ?? 0) / total * 100).toFixed(1)}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-[5px] px-[10px] py-1 rounded-md" style={{ background: `${s.color}14`, border: `1px solid ${s.color}33` }}>
            <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[11px] text-secondary font-medium">{s.label}</span>
            <span className="font-mono text-[11px] font-semibold" style={{ color: s.color }}>
              {fmtDuration((runtime[s.key] as number) ?? 0)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-[5px] px-[10px] py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <span className="text-[11px] text-muted font-medium">Total</span>
          <span className="font-mono text-[11px] text-primary font-semibold">{fmtDuration(total)}</span>
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
      <div className="flex items-baseline gap-2 mb-[10px]">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.07em]">Cost</div>
        <div className="font-mono text-[13px] font-bold text-primary">${totalCost.toFixed(4)}</div>
        <div className="text-[11px] text-muted">{fmtTokens(totalTok)} tok</div>
      </div>
      {totalCost > 0 && (
        <div className="flex h-1 rounded-full overflow-hidden mb-[10px]">
          {endpoints.map(ep => (
            <div
              key={ep.id}
              style={{ width: `${(ep.costUsd / totalCost * 100).toFixed(1)}%`, background: ep.color }}
              title={ep.label}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {endpoints.map(ep => (
          <div key={ep.id} className="grid p-[8px_12px] rounded-lg items-center gap-3 bg-black/[0.14]" style={{ gridTemplateColumns: '1fr auto auto auto' }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ep.color }} />
              <span className="text-[12px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{ep.label}</span>
              {ep.region && (
                <span className="text-[10px] text-muted px-[5px] py-[1px] bg-card-2 rounded shrink-0">{ep.region}</span>
              )}
            </div>
            <span className="font-mono text-[11px] text-muted text-right whitespace-nowrap">
              {fmtTokens(ep.tokIn)}→{fmtTokens(ep.tokOut)}
            </span>
            <span className="font-mono text-[11px] text-secondary text-right">{ep.calls}×</span>
            <span className="font-mono text-[12px] font-semibold text-primary text-right">
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

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[49] bg-black/[0.45]" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full flex flex-col bg-surface-2 border-l border-border z-50 fade-up w-[720px] max-w-[95vw]"
        style={{
          boxShadow: 'var(--shadow-float)',
        }}
      >
        {/* Sticky header */}
        <div className="p-[14px_20px] border-b border-hairline flex items-center gap-[10px] shrink-0 bg-surface-2">
          {/* Pass/fail dot */}
          {fixture && (
            <span
              className="w-[10px] h-[10px] rounded-full shrink-0"
              style={{
                background: isPass ? '#3daa6f' : '#d95555',
                boxShadow: `0 0 8px ${isPass ? '#3daa6f' : '#d95555'}88`,
              }}
            />
          )}

          {/* Case ID + name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="shrink-0 px-[6px] py-[1px] rounded bg-card-2 text-muted text-[11px]" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                {caseId.slice(0, 8)}
              </span>
              <span className="text-[13.5px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                {caseSummary ?? 'Test Case'}
              </span>
            </div>
          </div>

          {/* PASS/FAIL pill */}
          {fixture && (
            <span
              className="px-[9px] py-[3px] rounded-md text-[11px] font-bold shrink-0"
              style={{
                background: isPass ? 'rgba(61,170,111,0.12)' : 'rgba(217,85,85,0.12)',
                color: isPass ? '#3daa6f' : '#d95555',
              }}
            >{isPass ? 'PASS' : 'FAIL'}</span>
          )}

          {/* Index counter */}
          {caseIdx != null && totalCases != null && (
            <span className="text-[11.5px] text-muted shrink-0">
              {caseIdx + 1}/{totalCases}
            </span>
          )}

          {/* Nav arrows */}
          <div className="flex gap-[3px] shrink-0">
            <button
              onClick={onPrev} disabled={!onPrev}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] text-secondary bg-card border border-border"
              style={{ opacity: onPrev ? 1 : 0.3, cursor: onPrev ? 'pointer' : 'not-allowed' }}
            >←</button>
            <button
              onClick={onNext} disabled={!onNext}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] text-secondary bg-card border border-border"
              style={{ opacity: onNext ? 1 : 0.3, cursor: onNext ? 'pointer' : 'not-allowed' }}
            >→</button>
          </div>

          {/* Close */}
          <button onClick={onClose} className="text-muted px-[6px] py-1 rounded-md text-[14px] shrink-0">✕</button>
        </div>

        {/* Metric band */}
        {fixture && (
          <div className="grid grid-cols-4 shrink-0 border-b border-hairline">
            {[
              {
                label: 'Composite score',
                value: compositeScore != null ? `${compositeScore}%` : '—',
                sub: `${passed}/${evalTotal} evaluators`,
                color: compositeScore != null && compositeScore >= 80 ? '#3daa6f' : compositeScore != null && compositeScore >= 50 ? '#d4915c' : '#d95555',
              },
              { label: 'Runtime', value: fmtDuration(fixture.runtime.total), sub: undefined, color: 'var(--text-primary)' },
              { label: 'Cost', value: `$${totalCost.toFixed(4)}`, sub: undefined, color: 'var(--text-primary)' },
              { label: 'Tokens', value: fmtTokens(totalTokens), sub: undefined, color: 'var(--text-primary)' },
            ].map((m, i) => (
              <div key={i} className={`p-[12px_16px] ${i < 3 ? 'border-r border-hairline' : ''}`}>
                <div className="text-[10.5px] text-muted font-semibold uppercase tracking-[0.06em] mb-1">{m.label}</div>
                <div className="text-[18px] font-bold tracking-[-0.02em]" style={{ color: m.color }}>{m.value}</div>
                {m.sub && <div className="text-[11px] text-muted mt-[2px]">{m.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-[22px]">
          {isLoading && (
            <div className="text-center text-muted text-[13px] p-10">Loading…</div>
          )}

          {fixture && (
            <>
              {/* Input messages */}
              <section>
                <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.07em] mb-[10px]">Input</div>
                <div className="flex flex-col gap-[6px]">
                  {fixture.input.messages.map((m, i) => {
                    const roleColor = ROLE_COLOR[m.role.toLowerCase()] ?? 'var(--text-muted)';
                    return (
                      <div key={i} className="grid gap-[10px] p-[10px_12px] rounded-lg bg-card-2" style={{ gridTemplateColumns: '72px 1fr', borderLeft: `3px solid ${roleColor}` }}>
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] pt-[1px]" style={{ color: roleColor }}>
                          {m.role}
                        </span>
                        <span className="font-mono text-[11.5px] leading-[1.6] text-primary whitespace-pre-wrap break-words">
                          {m.content}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Expected vs Actual */}
              <section>
                <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.07em] mb-[10px]">Output</div>
                <div className="flex gap-3">
                  <OutputBlock label="Expected" color="#6b9eaa" value={fixture.expected} />
                  <OutputBlock label="Actual" color="#3daa6f" value={fixture.actual} />
                </div>
              </section>

              {/* Evaluator panels */}
              {fixture.evaluators.length > 0 && (
                <section>
                  <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.07em] mb-[10px]">
                    Evaluations <span className="text-muted text-[10px]" style={{ fontFamily: "'JetBrains Mono',monospace" }}>({passed}/{evalTotal})</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {fixture.evaluators.map((ev, i) => (
                      <EvaluatorPanel key={i} ev={ev} />
                    ))}
                  </div>
                </section>
              )}

              {/* Runtime + Cost side-by-side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-[14px_16px] rounded-xl bg-card-2">
                  <RuntimePanel runtime={fixture.runtime} />
                </div>
                {fixture.endpoints.length > 0 && (
                  <div className="p-[14px_16px] rounded-xl bg-card-2">
                    <CostPanel endpoints={fixture.endpoints} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
