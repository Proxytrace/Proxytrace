import { Trans, useLingui } from '@lingui/react/macro';
import type { AgentCallDto } from '../../api/models';
import { AlertTriangleIcon } from '../icons';
import { cn } from '../../lib/cn';
import { isOutlier, outlierFlagKeys, OUTLIER_FLAG_LABEL, OutlierFlag } from '../../lib/outliers';
import { useTraceAnomalyHits } from './useTraceAnomalyHits';

interface Props {
  trace: AgentCallDto;
}

/* eslint-disable lingui/no-unlocalized-strings -- Tailwind class recipes, not user-facing copy */
const FLAG_CHIP_CLS =
  'shrink-0 rounded-full text-caption px-1.5 py-0.5 whitespace-nowrap bg-warn-subtle text-warn';
const DETECTOR_CHIP_CLS =
  'shrink-0 rounded-full text-caption font-semibold px-1.5 py-0.5 whitespace-nowrap max-w-48 truncate bg-danger-subtle text-danger';
/* eslint-enable lingui/no-unlocalized-strings */

/**
 * Warning banner between the drawer header and the stat band, shown only for flagged traces so an
 * anomalous call is unmissable when its details open: the statistical outlier chips plus one row
 * per custom-detector hit (detector name, matched trigger, judge reasoning).
 */
export function TraceAnomalyBanner({ trace }: Props) {
  const { i18n } = useLingui();
  const hits = useTraceAnomalyHits(trace);

  if (!isOutlier(trace.outlierFlags)) return null;

  // A proxy-blocked call is the sharper statement — the request never reached the provider — so
  // the banner escalates from warn to danger and says so instead of the generic headline.
  const blocked = typeof trace.outlierFlags === 'number' && (trace.outlierFlags & OutlierFlag.Blocked) !== 0;

  // Detector-name chips replace the generic "Custom detector" flag chip; the generic chip only
  // remains as a fallback when the bit is set but no attribution row exists (detector deleted).
  // Same for the "Blocked at proxy" chip — the headline already states it.
  const flagKeys = outlierFlagKeys(trace.outlierFlags)
    .filter(key => (key !== 'CustomAnomaly' && key !== 'Blocked') || hits.length === 0);

  return (
    <div
      data-testid="trace-anomaly-banner"
      className={cn(
        'mx-5 mt-3.5 px-4 py-3 rounded-xl shrink-0 flex flex-col gap-2',
        blocked
          ? 'bg-danger-subtle border border-[color-mix(in_srgb,var(--danger)_35%,transparent)]'
          : 'bg-warn-subtle border border-[color-mix(in_srgb,var(--warn)_35%,transparent)]',
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangleIcon size={15} strokeWidth={2.2} className={cn('shrink-0', blocked ? 'text-danger' : 'text-warn')} />
        <span className={cn('text-title font-semibold', blocked ? 'text-danger' : 'text-warn')}>
          {blocked ? <Trans>Blocked at the proxy — never reached the provider</Trans> : <Trans>Anomalous trace</Trans>}
        </span>
        {flagKeys.map(key => (
          <span key={key} className={FLAG_CHIP_CLS}>{i18n._(OUTLIER_FLAG_LABEL[key])}</span>
        ))}
      </div>

      {hits.map(hit => (
        <div
          key={hit.detectorId}
          data-testid={`trace-anomaly-hit-${hit.detectorId}`}
          className="flex flex-col gap-1 pl-6"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={DETECTOR_CHIP_CLS}>{hit.detectorName}</span>
            <span className="text-caption text-muted">
              <Trans>matched <span className="mono text-secondary">“{hit.matchedTrigger}”</span></Trans>
            </span>
          </div>
          {hit.reasoning && <p className="text-body-sm text-secondary">{hit.reasoning}</p>}
        </div>
      ))}
    </div>
  );
}
