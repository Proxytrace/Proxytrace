import { useLingui } from '@lingui/react/macro';
import { Tooltip } from '../../../components/ui/Tooltip';
import { cn } from '../../../lib/cn';
import { OUTLIER_FLAG_LABEL, outlierFlagKeys } from '../../../lib/outliers';
import type { AnomalyListItemDto } from '../../../api/models';

interface Props {
  item: AnomalyListItemDto;
}

/** Reason chips shown before the rest collapses into a "+N" chip — keeps every row one line. */
const VISIBLE_REASONS = 2;

interface Reason {
  key: string;
  label: string;
  tone: 'warn' | 'danger';
  tooltip?: string;
  testId?: string;
}

/* eslint-disable lingui/no-unlocalized-strings -- css classes, not UI copy */
const REASON_TONE_CLS = {
  warn: 'bg-warn-subtle text-warn',
  danger: 'bg-danger-subtle text-danger',
} as const;

const CHIP_CLS = 'shrink-0 rounded-none text-caption px-1.5 py-0.5 whitespace-nowrap max-w-32 truncate';
/* eslint-enable lingui/no-unlocalized-strings */

/** Why a call was flagged, as at most {@link VISIBLE_REASONS} chips plus a "+N" overflow chip:
 * warn-tinted statistical flags and danger-tinted custom-detector hits (tooltip carries the matched
 * trigger and the reviewer's reasoning). */
export function AnomalyReasonChips({ item }: Props) {
  const { t, i18n } = useLingui();
  const { call, customAnomalies } = item;

  // A custom-flagged call shows its detector-name chips instead of the generic "Custom detector"
  // label; the generic chip only remains as a fallback when the bit is set but no attribution row
  // exists (e.g. detector deleted since).
  const reasons: Reason[] = [
    ...outlierFlagKeys(call.outlierFlags)
      .filter(key => key !== 'CustomAnomaly' || customAnomalies.length === 0)
      .map<Reason>(key => ({ key, label: i18n._(OUTLIER_FLAG_LABEL[key]), tone: 'warn' })),
    ...customAnomalies.map<Reason>(hit => ({
      key: hit.detectorId,
      label: hit.detectorName,
      tone: 'danger',
      tooltip: hit.reasoning
        ? t`Matched "${hit.matchedTrigger}" — ${hit.reasoning}`
        : t`Matched "${hit.matchedTrigger}"`,
      testId: `anomaly-detector-chip-${call.id}-${hit.detectorId}`,
    })),
  ];
  const visible = reasons.slice(0, VISIBLE_REASONS);
  const overflow = reasons.slice(VISIBLE_REASONS);

  return (
    <span className="flex items-center gap-1">
      {visible.map(reason => {
        const chip = (
          <span key={reason.key} data-testid={reason.testId} className={cn(CHIP_CLS, REASON_TONE_CLS[reason.tone])}>
            {reason.label}
          </span>
        );
        return reason.tooltip ? <Tooltip key={reason.key} content={reason.tooltip}>{chip}</Tooltip> : chip;
      })}
      {overflow.length > 0 && (
        <Tooltip content={overflow.map(r => r.label).join(' · ')}>
          <span className={cn(CHIP_CLS, 'bg-card-2 text-secondary')} data-testid={`anomaly-reason-overflow-${call.id}`}>
            +{overflow.length}
          </span>
        </Tooltip>
      )}
    </span>
  );
}
