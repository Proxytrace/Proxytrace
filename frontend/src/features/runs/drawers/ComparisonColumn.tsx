import { Trans, useLingui } from '@lingui/react/macro';
import { fmtDuration, fmtTokens, fmtCost } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';
import { cn } from '../../../lib/cn';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { compositeColor, fixtureSummary } from '../results';
import type { TestCaseFixtureDto, TestRunDto } from '../../../api/models';
import { OutputBlock, PassFailTag, EvaluatorList, RequestPreviewButton } from './panels';

interface ComparisonColumnProps {
  run: TestRunDto;
  caseId: string;
  fixture: TestCaseFixtureDto | undefined;
  isLoading: boolean;
  focused: boolean;
  /** "sample i/N" shown under the endpoint name when the endpoint was sampled more than once. */
  sampleLabel?: string;
}

/** One model's column in the comparison drawer: header, metric strip, actual output + evaluators. */
export function ComparisonColumn({ run, caseId, fixture, isLoading, focused, sampleLabel }: ComparisonColumnProps) {
  const { t } = useLingui();
  const mc = modelColor(run.endpointName);
  const { total, allPass, composite, totalCost: cost, tokensOut } = fixtureSummary(fixture);
  const failed = total > 0 && !allPass;

  const borderCls = focused
    ? ''
    : failed
      ? cn('border-[color-mix(in_srgb,var(--danger)_50%,transparent)]')
      : allPass
        ? cn('border-[color-mix(in_srgb,var(--success)_35%,transparent)]')
        : cn('border-hairline');

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg p-3.5 border min-w-[300px] ${borderCls} ${failed ? 'bg-[color-mix(in_srgb,var(--danger)_6%,transparent)]' : 'bg-card-2'}`}
      style={focused ? { borderColor: mc } : undefined}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: mc }} />
        <span className="flex flex-col min-w-0 flex-1">
          <span className="mono text-body font-semibold truncate">{run.endpointName}</span>
          {sampleLabel && <span className="mono text-caption text-muted truncate">{sampleLabel}</span>}
        </span>
        <RequestPreviewButton runId={run.id} caseId={caseId} model={run.endpointName} />
        {fixture && <PassFailTag pass={allPass} />}
      </div>

      {/* Metric strip */}
      {fixture && (
        <div className="flex items-center gap-2 flex-wrap text-body-sm">
          <span className="mono font-bold" style={{ color: compositeColor(composite) }}>{composite != null ? `${composite}%` : '—'}</span>
          <span className="text-muted">·</span>
          <span className="mono text-secondary">{fmtDuration(fixture.runtime.total)}</span>
          <span className="text-muted">·</span>
          <span className="mono text-secondary">{fmtTokens(tokensOut)} <Trans>out</Trans></span>
          <span className="text-muted">·</span>
          <span className="mono text-secondary">{fmtCost(cost)}</span>
        </div>
      )}

      {isLoading && <SkeletonList rows={2} height={70} gap={6} />}

      {fixture && (
        <>
          <OutputBlock label={t`Actual`} color={allPass ? 'var(--success)' : 'var(--danger)'} value={fixture.actual} />
          <EvaluatorList evaluators={fixture.evaluators} />
        </>
      )}

      {!isLoading && !fixture && (
        <span className="text-body-sm text-muted italic"><Trans>This case was not run for this model.</Trans></span>
      )}
    </div>
  );
}
