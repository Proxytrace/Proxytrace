import type { TestSuiteDto } from '../../../api/models';
import { agentColor, EVALUATOR_KIND_COLOR } from '../../../lib/colors';
import { fmtRelative, fmtDate } from '../../../lib/format';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EditIcon, TrashIcon, PlayFilledIcon } from '../../../components/icons';
import { sparklinePath } from '../../../lib/charts';
import { passRateColor } from '../suitesMeta';

interface Props {
  suite: TestSuiteDto;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SuiteCard({ suite, onRun, onEdit, onDelete }: Props) {
  const c = agentColor(suite.agentId);
  const hasRuns = suite.totalRuns > 0;
  const passColor = passRateColor(suite.passRate);
  const delta =
    suite.passRate !== null && suite.prevPassRate !== null
      ? suite.passRate - suite.prevPassRate
      : null;

  return (
    <div
      className="bg-card rounded-lg shadow-[var(--shadow-card)] flex flex-col overflow-hidden relative transition-shadow duration-[180ms] hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_4px_20px_rgba(0,0,0,0.45),0_0_0_1px_color-mix(in_srgb,var(--suite-accent)_25%,transparent)]"
      style={{ ['--suite-accent' as string]: c }}
    >
      {/* Accent bar — runtime colour */}
      <div
        className="h-[3px]"
        style={{ background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 28%, transparent))` }}
      />

      <div className="px-[18px] py-4 flex-1 flex flex-col gap-3">
        {/* Top row */}
        <div className="flex items-start gap-[10px]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-h2 font-bold tracking-[-0.01em]">{suite.name}</span>
              {!hasRuns && (
                <span className="px-[7px] py-[2px] bg-warn-subtle text-warn rounded-full text-caption font-semibold">
                  No runs yet
                </span>
              )}
            </div>
            {/* Agent badge — runtime colour */}
            <span
              className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-full text-[10.5px] font-semibold shadow-[var(--shadow-pill)]"
              style={{
                background: `color-mix(in srgb, ${c} 14%, transparent)`,
                color: c,
                border: `1px solid color-mix(in srgb, ${c} 32%, transparent)`,
              }}
            >
              {suite.agentName}
            </span>
          </div>

          <div className="flex gap-1 shrink-0">
            <button
              onClick={onRun}
              data-write
              className="inline-flex items-center gap-[6px] px-[14px] py-2 rounded-md text-[12.5px] font-semibold bg-[image:var(--grad-accent)] text-white shadow-[var(--shadow-btn)] whitespace-nowrap hover:opacity-[0.88] transition-opacity duration-[120ms]"
            >
              <PlayFilledIcon size={11} /> {hasRuns ? 'Run again' : 'Run now'}
            </button>
            <button onClick={onEdit} data-write className="btn-icon" aria-label="Edit suite">
              <EditIcon size={13} />
            </button>
            <button onClick={onDelete} className="btn-icon btn-icon-danger" aria-label="Delete suite">
              <TrashIcon size={13} />
            </button>
          </div>
        </div>

        {/* Description */}
        {suite.description && (
          <p className="text-[12.5px] text-muted leading-[1.55] m-0">{suite.description}</p>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-[10px]">
          {/* Pass rate */}
          <div className="px-3 py-[10px] bg-card-2 rounded-md shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
            <div className="text-caption text-muted font-semibold tracking-[0.07em] uppercase mb-1">
              Pass rate
            </div>
            <div className="flex items-baseline gap-[6px]">
              <span
                className="text-[22px] font-bold tracking-[-0.02em]"
                style={{ color: passColor }}
              >
                {suite.passRate !== null ? `${Math.round(suite.passRate)}%` : '—'}
              </span>
              {delta !== null && (
                <span
                  className="text-[11px] font-semibold inline-flex items-center gap-[2px]"
                  style={{ color: delta >= 0 ? 'var(--success)' : 'var(--danger)' }}
                >
                  {delta >= 0 ? '↗' : '↘'}
                  {Math.abs(Math.round(delta))}pt
                </span>
              )}
            </div>
            {hasRuns && suite.passRateTrend.length >= 2 && (
              <svg
                width={80}
                height={20}
                className="block mt-1 overflow-visible"
              >
                <path
                  d={sparklinePath(suite.passRateTrend, 80, 20)}
                  fill="none"
                  stroke={passColor}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.7}
                />
              </svg>
            )}
          </div>

          {/* Test cases */}
          <div className="px-3 py-[10px] bg-card-2 rounded-md shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
            <div className="text-caption text-muted font-semibold tracking-[0.07em] uppercase mb-1">
              Test cases
            </div>
            <div className="text-[22px] font-bold tracking-[-0.02em]">{suite.testCases.length}</div>
            <div className="text-[11px] text-muted mt-[2px]">
              {suite.totalRuns} run{suite.totalRuns !== 1 ? 's' : ''} total
            </div>
          </div>

          {/* Last run */}
          <div className="px-3 py-[10px] bg-card-2 rounded-md shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
            <div className="text-caption text-muted font-semibold tracking-[0.07em] uppercase mb-1">
              Last run
            </div>
            <div
              className="text-h2 font-semibold mt-[2px]"
              style={{ color: hasRuns ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {suite.lastRunAt ? fmtRelative(suite.lastRunAt) : 'Never'}
            </div>
            <div className="text-[11px] text-muted mt-[2px] font-mono">
              {suite.lastRunGroupId ? suite.lastRunGroupId.slice(0, 8) : 'Not yet run'}
            </div>
          </div>
        </div>

        {/* Evaluator badges + tags */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {suite.evaluators.length > 0 && (
            <div className="flex gap-[5px] flex-wrap">
              {suite.evaluators.map(e => (
                <ColoredBadge key={e.id} color={EVALUATOR_KIND_COLOR[e.kind]} label={e.kind} shape="rounded" />
              ))}
            </div>
          )}
          {suite.tags.length > 0 && (
            <div className="flex gap-[5px] flex-wrap">
              {suite.tags.map(t => (
                <span
                  key={t}
                  className="px-2 py-[2px] bg-card-2 text-muted rounded-[5px] text-[10.5px] font-mono"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-hairline text-[11px] text-muted">
          <span>Created {fmtDate(suite.createdAt)}</span>
          <button
            className="text-[11.5px] text-[color:var(--accent-hover)] font-medium"
            onClick={onEdit}
          >
            View cases ›
          </button>
        </div>
      </div>
    </div>
  );
}
