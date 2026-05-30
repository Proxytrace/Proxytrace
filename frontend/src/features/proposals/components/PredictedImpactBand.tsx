import { cn } from '../../../lib/cn';
import { Card } from '../../../components/ui/Card';
import type { OptimizationProposalDto } from '../../../api/models';
import { TONE_COLOR, deltaTone, formatCostDelta, formatLatencyDelta } from '../shared';
import type { DisplayTone } from '../shared';

interface Props {
  dto: OptimizationProposalDto;
}

function DeltaBigCell({ label, value, tone }: { label: string; value: string; tone: DisplayTone }) {
  return (
    <div className="bg-card-2 rounded-md px-3 py-2.5">
      <div className="text-caption text-muted font-semibold uppercase tracking-[0.07em] mb-1">{label}</div>
      <div
        className="mono font-bold tracking-[-0.02em] leading-none text-[22px]"
        style={{ color: TONE_COLOR[tone] }}
      >
        {value}
      </div>
    </div>
  );
}

export function PredictedImpactBand({ dto }: Props) {
  const passDeltaTone = deltaTone(dto.expectedPassRateDelta, false);
  const fmtPct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const deltaPts = dto.expectedPassRateDelta == null ? null : Math.round(dto.expectedPassRateDelta * 100);

  const ms = dto.details.kind === 'ModelSwitch' ? dto.details : null;

  return (
    <Card elevation="raised" padding="md" data-testid="predicted-impact-band">
      <div className="text-caption text-muted font-semibold uppercase tracking-[0.07em] mb-2.5">
        Predicted impact
      </div>
      <div className={cn('grid gap-2.5', ms ? 'grid-cols-3' : 'grid-cols-1')}>
        {/* Pass rate cell — current → proposed */}
        <div className="bg-card-2 rounded-md px-3 py-2.5">
          <div className="text-caption text-muted font-semibold uppercase tracking-[0.07em] mb-1">
            Pass rate
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="mono font-bold tracking-[-0.02em] leading-none text-muted text-[16px]">
              {fmtPct(dto.currentPassRate)}
            </span>
            <span className="text-body-sm text-muted">→</span>
            <span
              className="mono font-bold tracking-[-0.02em] leading-none text-[22px]"
              style={{ color: TONE_COLOR[passDeltaTone] }}
            >
              {fmtPct(dto.proposedPassRate)}
            </span>
            {deltaPts != null && deltaPts !== 0 && (
              <span
                className="mono text-body-sm font-semibold"
                style={{ color: TONE_COLOR[passDeltaTone] }}
              >
                {deltaPts > 0 ? '+' : '−'}{Math.abs(deltaPts)}pt
              </span>
            )}
          </div>
        </div>

        {ms && (
          <>
            <DeltaBigCell label="Cost / 1k"   value={formatCostDelta(ms.expectedCostDelta)}    tone={deltaTone(ms.expectedCostDelta, true)}/>
            <DeltaBigCell label="Latency p50" value={formatLatencyDelta(ms.expectedLatencyMs)} tone={deltaTone(ms.expectedLatencyMs, true)}/>
          </>
        )}
      </div>
    </Card>
  );
}
