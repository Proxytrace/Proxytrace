import type { TestSuiteDto } from '../../../api/models';
import { EVALUATOR_KIND_COLOR } from '../../../lib/colors';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { fmtPct, fmtRelative } from '../../../lib/format';

export function PromoteModalSuiteStats({ suite }: { suite: TestSuiteDto }) {
  const passRateLabel = suite.passRate != null ? fmtPct(suite.passRate) : '—';
  const lastRunLabel = suite.lastRunAt ? fmtRelative(suite.lastRunAt) : 'never';

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Cases" value={String(suite.testCases.length)} accent="var(--accent-primary)" />
        <Stat label="Pass rate" value={passRateLabel} accent="var(--success)" />
        <Stat label="Total runs" value={String(suite.totalRuns)} accent="var(--teal)" />
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

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-card rounded-[8px] px-2 py-[8px] text-center shadow-[inset_0_0_0_1px_var(--border-color)]">
      <div className="text-[15px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      <div className="text-[9px] text-muted uppercase tracking-[0.06em] mt-[1px]">{label}</div>
    </div>
  );
}
