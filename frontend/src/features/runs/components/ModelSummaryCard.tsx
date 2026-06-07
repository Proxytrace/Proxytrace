import type { LeaderboardEntry } from '../comparison';
import { passRateColor } from '../results';
import { TestRunStatus } from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import { fmtDuration, fmtCost, fmtTokens } from '../../../lib/format';
import { TargetIcon, ZapIcon, CoinsIcon, ArrowDownIcon } from '../../../components/icons';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { ModelTag } from './ModelTag';

/** One per-model comparison card: headline pass rate, counts, cost/token/duration meta. */
export function ModelSummaryCard({ entry, multi }: { entry: LeaderboardEntry; multi: boolean }) {
  const { run, passRate, passed, failed, pending } = entry;
  const running = run.status === TestRunStatus.Running;
  const pendingRun = run.status === TestRunStatus.Pending;
  const pc = passRateColor(passRate);

  return (
    <Card padding="none">
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: modelColor(run.endpointName) }} />
      <div className="p-3 pl-[18px]">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <ModelTag name={run.endpointName} />
          {multi && (
            <div className="flex gap-1 flex-wrap justify-end">
              {entry.isBest && <WinnerBadge tone="best" label="Best" icon={<TargetIcon size={9} />} />}
              {entry.isFastest && <WinnerBadge tone="fast" label="Fast" icon={<ZapIcon size={9} />} />}
              {entry.isCheapest && <WinnerBadge tone="cheap" label="Cheap" icon={<CoinsIcon size={9} />} />}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-1.5 mb-1.5">
          <span className="mono text-display font-bold tracking-[-0.02em] leading-none" style={{ color: pc }}>
            {passRate === null ? '—' : passRate}
          </span>
          <span className="text-h2 text-muted font-medium">%</span>
          {running && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-body-sm text-accent font-semibold">
              <Spinner size={12} color="var(--accent-primary)" /> running
            </span>
          )}
        </div>

        <div className="flex gap-3 mb-2.5 mono text-body-sm">
          <span className="text-success font-semibold">{passed}<span className="text-muted font-normal"> pass</span></span>
          <span className="text-danger font-semibold">{failed}<span className="text-muted font-normal"> fail</span></span>
          {pending > 0 && <span className="text-muted font-semibold">{pending}<span className="font-normal"> pending</span></span>}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-hairline">
          <MiniStat label="Duration" value={pendingRun ? '—' : fmtDuration(run.durationMs)} accent={multi && entry.isFastest} />
          <MiniStat label="Cost" value={fmtCost(entry.costUsd)} accent={multi && entry.isCheapest} />
          <MiniStat label="Tokens" value={entry.tokensIn != null ? `${fmtTokens(entry.tokensIn)}/${fmtTokens(entry.tokensOut ?? 0)}` : '—'} />
        </div>

        {multi && entry.deltaVsBest !== null && entry.deltaVsBest > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 text-caption text-muted">
            <ArrowDownIcon size={10} />
            <span className="mono text-danger font-semibold">−{entry.deltaVsBest}pt</span>
            <span>vs best</span>
          </div>
        )}
      </div>
    </Card>
  );
}

const WINNER_TONE = {
  best: 'bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success',
  fast: 'bg-[color-mix(in_srgb,var(--teal)_16%,transparent)] text-teal',
  cheap: 'bg-[color-mix(in_srgb,var(--accent-primary)_16%,transparent)] text-accent',
} as const;

function WinnerBadge({ tone, label, icon }: { tone: keyof typeof WINNER_TONE; label: string; icon: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-caption font-bold tracking-[0.04em] ${WINNER_TONE[tone]}`}>
      {icon}{label.toUpperCase()}
    </span>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-caption font-semibold text-muted tracking-[0.06em] uppercase mb-0.5">{label}</div>
      <div className={`mono text-body-sm font-semibold truncate ${accent ? 'text-accent' : 'text-secondary'}`}>{value}</div>
    </div>
  );
}
