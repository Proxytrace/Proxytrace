import { useState, Fragment } from 'react';
import { XIcon, ChevronDownIcon, CheckIcon } from '../../../components/icons';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtDuration, fmtTokens } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';
import { isDivergent } from '../results';
import type {
  EvaluatorFixtureResultDto,
  OutputValueDto,
  RuntimeBreakdownDto,
  EndpointUsageDto,
  TestCaseMessageFixtureDto,
  TestCaseFixtureDto,
  TestRunDto,
} from '../../../api/models';

export const SECTION_LABEL = 'text-title font-semibold text-secondary mb-2.5';

const ROLE_COLOR: Record<string, string> = {
  system: 'var(--accent-primary)',
  user: 'var(--teal)',
  assistant: 'var(--success)',
  tool: 'var(--text-muted)',
};

// ── Conversation / output ────────────────────────────────────────────────────

/** Renders fixture input messages (shared by both drawers). */
export function RoleMessageList({ messages }: { messages: TestCaseMessageFixtureDto[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {messages.map((m, i) => {
        const roleColor = ROLE_COLOR[m.role.toLowerCase()] ?? 'var(--text-muted)';
        return (
          <div
            key={i}
            className="grid grid-cols-[72px_1fr] gap-2.5 px-3 py-2.5 rounded-lg bg-card-2 border-l-[3px]"
            style={{ borderLeftColor: roleColor }}
          >
            <span className="text-body-sm font-semibold pt-px" style={{ color: roleColor }}>{m.role}</span>
            <span className="mono text-body-sm leading-relaxed text-primary whitespace-pre-wrap break-words">{m.content}</span>
          </div>
        );
      })}
    </div>
  );
}

function outputStr(val: OutputValueDto): string {
  if (val.kind === 'message') return val.content ?? '';
  if (val.kind === 'tool_call') return JSON.stringify({ tool: val.tool, arguments: val.arguments }, null, 2);
  return JSON.stringify(val, null, 2);
}

export function OutputBlock({ label, color, value }: { label: string; color: string; value: OutputValueDto }) {
  const text = outputStr(value);
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
        <span className="text-body-sm font-semibold text-secondary">{label}</span>
        {value.kind === 'tool_call' && (
          <span className="mono px-[5px] py-px rounded-sm text-caption bg-accent-subtle text-accent">tool_call</span>
        )}
      </div>
      <div
        className="rounded-lg px-3 py-2.5 max-h-[160px] overflow-y-auto mono text-body-sm leading-relaxed text-primary whitespace-pre-wrap break-words bg-black/[0.18] border"
        style={{ borderColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        {text || <span className="text-muted italic">(empty)</span>}
      </div>
    </div>
  );
}

// ── Pass/fail ────────────────────────────────────────────────────────────────

export function PassFailTag({ pass, size = 'sm' }: { pass: boolean; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'px-2.5 py-[3px] text-body-sm' : 'px-2 py-[2px] text-body-sm';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-bold shrink-0 ${cls} ${pass ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
      {pass ? <CheckIcon size={11} strokeWidth={2.5} /> : <XIcon size={11} strokeWidth={2.5} />}
      {pass ? 'Pass' : 'Fail'}
    </span>
  );
}

// ── Evaluators ───────────────────────────────────────────────────────────────

export function EvaluatorPanel({ ev, defaultOpen }: { ev: EvaluatorFixtureResultDto; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasDetails = !!ev.note || ev.breakdown.length > 0 || !!ev.desc;

  return (
    <div className="bg-card-2 rounded-md overflow-hidden border-l-[3px]" style={{ borderLeftColor: ev.color }}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer text-left ${FOCUS_RING}`}
      >
        <span className="px-[7px] py-[2px] rounded-full text-caption font-semibold shrink-0" style={{ background: `color-mix(in srgb, ${ev.color} 18%, transparent)`, color: ev.color }}>{ev.evaluatorKind}</span>
        <span className="text-title font-semibold flex-1 min-w-0 truncate">{ev.evaluatorName}</span>
        {typeof ev.score === 'number' && (
          <span className="mono text-body text-secondary shrink-0">{(ev.score * 100).toFixed(0)}%</span>
        )}
        <PassFailTag pass={ev.pass} />
        {hasDetails && (
          <span className={`flex text-muted shrink-0 transition-transform duration-[var(--motion-base)] ${open ? 'rotate-180' : ''}`}>
            <ChevronDownIcon size={13} />
          </span>
        )}
      </button>

      {open && hasDetails && (
        <div className="border-t border-hairline">
          {ev.desc && (
            <div className="px-3.5 pt-2.5 pb-0.5 text-body-sm text-muted italic leading-snug">{ev.desc}</div>
          )}
          {ev.note && (
            <div className="px-3.5 py-2.5">
              <div className="text-caption font-semibold text-muted mb-1.5">Reasoning</div>
              <div className="text-body text-secondary leading-snug">{ev.note}</div>
            </div>
          )}
          {ev.breakdown.length > 0 && (
            <div className={`px-3.5 py-2.5 grid grid-cols-[1fr_auto_auto] items-center gap-x-3.5 gap-y-1.5 ${(ev.desc || ev.note) ? 'border-t border-hairline' : ''}`}>
              {ev.breakdown.map((b, i) => (
                <div key={i} className="contents">
                  <span className="text-body text-muted">{b.k}</span>
                  <span className="mono text-body-sm text-secondary text-right">{b.v}</span>
                  <span className={`flex justify-end ${b.match ? 'text-success' : 'text-danger'}`}>
                    {b.match ? <CheckIcon size={12} strokeWidth={2.5} /> : <XIcon size={12} strokeWidth={2.5} />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Evaluator panels list — failing evaluators expanded by default. */
export function EvaluatorList({ evaluators }: { evaluators: EvaluatorFixtureResultDto[] }) {
  if (evaluators.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {evaluators.map((ev, i) => <EvaluatorPanel key={i} ev={ev} defaultOpen={!ev.pass} />)}
    </div>
  );
}

// ── Runtime ──────────────────────────────────────────────────────────────────

const RUNTIME_SEGMENTS: { key: keyof RuntimeBreakdownDto; label: string; color: string }[] = [
  { key: 'ttft', label: 'TTFT', color: 'var(--teal)' },
  { key: 'gen', label: 'Gen', color: 'var(--accent-primary)' },
  { key: 'tools', label: 'Tools', color: 'var(--success)' },
  { key: 'judge', label: 'Judge', color: 'var(--warn)' },
];

export function RuntimePanel({ runtime }: { runtime: RuntimeBreakdownDto }) {
  const segments = RUNTIME_SEGMENTS.filter(s => (runtime[s.key] as number | null | undefined) != null && (runtime[s.key] as number) > 0);
  const total = runtime.total || segments.reduce((acc, s) => acc + ((runtime[s.key] as number) ?? 0), 0);
  return (
    <div>
      <div className={SECTION_LABEL}>Runtime</div>
      <div className="flex h-[5px] rounded-full overflow-hidden mb-2.5 bg-white/[0.04]">
        {segments.map(s => (
          <div
            key={s.key}
            style={{ width: `${(((runtime[s.key] as number) ?? 0) / total * 100).toFixed(1)}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${s.color} 33%, transparent)` }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-body-sm text-secondary font-medium">{s.label}</span>
            <span className="mono text-body-sm font-semibold" style={{ color: s.color }}>
              {fmtDuration((runtime[s.key] as number) ?? 0)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-wash-hover)]">
          <span className="text-body-sm text-muted font-medium">Total</span>
          <span className="mono text-body-sm text-primary font-semibold">{fmtDuration(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Cost ─────────────────────────────────────────────────────────────────────

export function CostPanel({ endpoints }: { endpoints: EndpointUsageDto[] }) {
  const totalCost = endpoints.reduce((s, ep) => s + ep.costUsd, 0);
  const totalTok = endpoints.reduce((s, ep) => s + ep.tokIn + ep.tokOut, 0);
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2.5">
        <div className="text-title font-semibold text-secondary">Cost</div>
        <div className="mono text-h2 font-bold text-primary">${totalCost.toFixed(4)}</div>
        <div className="text-body-sm text-muted">{fmtTokens(totalTok)} tok</div>
      </div>
      {totalCost > 0 && (
        <div className="flex h-1 rounded-full overflow-hidden mb-2.5">
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
          <div key={ep.id} className="grid grid-cols-[1fr_auto_auto_auto] px-3 py-2 rounded-lg items-center gap-3 bg-black/[0.14]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ep.color }} />
              <span className="text-body font-semibold truncate">{ep.label}</span>
              {ep.region && (
                <span className="text-caption text-muted px-[5px] py-px bg-card-2 rounded-sm shrink-0">{ep.region}</span>
              )}
            </div>
            <span className="mono text-body-sm text-muted text-right whitespace-nowrap">
              {fmtTokens(ep.tokIn)}→{fmtTokens(ep.tokOut)}
            </span>
            <span className="mono text-body-sm text-secondary text-right">{ep.calls}×</span>
            <span className="mono text-body font-semibold text-primary text-right">${ep.costUsd.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Evaluator breakdown grid (model comparison) ──────────────────────────────

export function EvalBreakdown({ runs, fixtures }: { runs: TestRunDto[]; fixtures: (TestCaseFixtureDto | undefined)[] }) {
  // Union of evaluator names, in first-seen order. Same suite ⇒ same evaluators per model.
  const names: string[] = [];
  fixtures.forEach(f => f?.evaluators.forEach(e => { if (!names.includes(e.evaluatorName)) names.push(e.evaluatorName); }));
  if (names.length === 0) return null;

  const gridCols = `minmax(140px,1.4fr) repeat(${runs.length}, minmax(84px,1fr))`;

  return (
    <section>
      <div className={SECTION_LABEL}>Evaluator breakdown</div>
      <div className="overflow-x-auto rounded-lg border border-hairline">
        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
          {/* Header */}
          <div className="bg-card px-3 py-2 border-b border-hairline text-body-sm font-semibold text-secondary">Evaluator</div>
          {runs.map(run => (
            <div key={run.id} className="bg-card px-2 py-2 border-b border-hairline flex items-center justify-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: modelColor(run.endpointName) }} />
              <span className="mono text-caption font-semibold truncate">{run.endpointName}</span>
            </div>
          ))}

          {/* Rows */}
          {names.map(name => {
            const cells = fixtures.map(f => f?.evaluators.find(e => e.evaluatorName === name) ?? null);
            const divergent = isDivergent(cells.flatMap(c => (c ? [c.pass] : [])));
            const rowCls = divergent
              ? 'bg-[color-mix(in_srgb,var(--accent-primary)_7%,transparent)]'
              : '';
            return (
              <Fragment key={name}>
                <div
                  className={`px-3 py-2 border-b border-hairline flex items-center min-w-0 ${rowCls} ${divergent ? 'shadow-[inset_3px_0_0_var(--accent-primary)]' : ''}`}
                  title={name}
                >
                  <span className="truncate text-body">{name}</span>
                </div>
                {cells.map((c, ci) => (
                  <div key={ci} className={`px-2 py-2 border-b border-hairline flex items-center justify-center gap-1 ${rowCls}`}>
                    {c
                      ? <>
                          {c.pass ? <CheckIcon size={12} strokeWidth={2.5} className="text-success shrink-0" /> : <XIcon size={12} strokeWidth={2.5} className="text-danger shrink-0" />}
                          {typeof c.score === 'number' && (
                            <span className={`mono text-caption font-semibold ${c.pass ? 'text-success' : 'text-danger'}`}>{(c.score * 100).toFixed(0)}%</span>
                          )}
                        </>
                      : <span className="text-muted">—</span>}
                  </div>
                ))}
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
