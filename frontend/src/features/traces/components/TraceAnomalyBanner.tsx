import { Trans, useLingui } from '@lingui/react/macro';
import type { AgentCallDto } from '../../../api/models';
import { AlertTriangleIcon } from '../../../components/icons';
import { isOutlier, outlierFlagKeys, OUTLIER_FLAG_LABEL } from '../../../lib/outliers';
import { useTraceAnomalyHits } from '../hooks/useTraceAnomalyHits';

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

  // Detector-name chips replace the generic "Custom detector" flag chip; the generic chip only
  // remains as a fallback when the bit is set but no attribution row exists (detector deleted).
  const flagKeys = outlierFlagKeys(trace.outlierFlags)
    .filter(key => key !== 'CustomAnomaly' || hits.length === 0);

  return (
    <div
      data-testid="trace-anomaly-banner"
      className="mx-5 mt-3.5 px-4 py-3 rounded-xl bg-warn-subtle border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] shrink-0 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangleIcon size={15} strokeWidth={2.2} className="text-warn shrink-0" />
        <span className="text-title font-semibold text-warn"><Trans>Anomalous trace</Trans></span>
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
