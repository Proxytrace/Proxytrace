import type { TestSuiteDto } from '../../../api/models';
import { EVALUATOR_KIND_COLOR } from '../../../lib/colors';
import { fmtPct, fmtRelative } from '../../../lib/format';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';

type StatTone = 'accent' | 'success' | 'teal';

const TONE_CLS: Record<StatTone, string> = {
  accent: 'text-accent',
  success: 'text-success',
  teal: 'text-teal',
};

interface StatProps {
  label: string;
  value: string;
  tone: StatTone;
}

function Stat({ label, value, tone }: StatProps) {
  return (
    <div className="bg-card rounded-[8px] px-2 py-[8px] text-center shadow-[inset_0_0_0_1px_var(--border-color)]">
      <div className={`text-[15px] font-bold font-mono ${TONE_CLS[tone]}`}>{value}</div>
      <div className="text-[9px] text-muted uppercase tracking-[0.06em] mt-[1px]">{label}</div>
    </div>
  );
}

interface SuiteStatsProps {
  suite: TestSuiteDto;
}

/**
 * Compact stats panel for a selected test suite (cases / pass rate / total runs,
 * evaluator chips, last-run timestamp). Rendered inside the PromoteModal sidebar.
 */
export function SuiteStats({ suite }: SuiteStatsProps) {
  const passRateLabel = suite.passRate != null ? fmtPct(suite.passRate) : '—';
  const lastRunLabel = suite.lastRunAt ? fmtRelative(suite.lastRunAt) : 'never';

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Cases" value={String(suite.testCases.length)} tone="accent" />
        <Stat label="Pass rate" value={passRateLabel} tone="success" />
        <Stat label="Total runs" value={String(suite.totalRuns)} tone="teal" />
      </div>
      <div>
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.08em] mb-[6px]">
          Evaluators
        </div>
        {suite.evaluators.length === 0 ? (
          <div className="text-[11px] text-muted italic">None configured</div>
        ) : (
          <div className="flex flex-wrap gap-[5px]">
            {suite.evaluators.map(e => (
              <ColoredBadge key={e.id} color={EVALUATOR_KIND_COLOR[e.kind]} label={e.kind} size="sm" />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-[10.5px] text-muted">
        <span>Last run</span>
        <span className="text-secondary">{lastRunLabel}</span>
      </div>
    </div>
  );
}
