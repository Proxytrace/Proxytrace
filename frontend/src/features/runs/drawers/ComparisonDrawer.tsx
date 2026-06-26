import { Trans, useLingui } from '@lingui/react/macro';
import { fmtDuration, fmtTokens, fmtCost } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';
import { cn } from '../../../lib/cn';
import { Skeleton, SkeletonList } from '../../../components/ui/Skeleton';
import { compositeColor, fixtureSummary } from '../results';
import { buildCohorts } from '../cohorts';
import { useComparisonFixtures } from '../hooks/useComparisonFixtures';
import type { TestCaseFixtureDto, TestRunDto } from '../../../api/models';
import { DrawerShell } from './DrawerShell';
import {
  OutputBlock,
  PassFailTag,
  EvaluatorList,
  RoleMessageList,
  EvalBreakdown,
  RequestPreviewButton,
  SECTION_LABEL,
} from './panels';

interface Props {
  runs: TestRunDto[];
  /** Samples per endpoint; >1 adds per-column "sample i/N" sub-labels. */
  sampleCount?: number;
  caseId: string;
  caseSummary?: string;
  caseIdx?: number;
  total?: number;
  /** Endpoint whose sample columns to highlight (the cohort cell the user clicked). */
  focusEndpointId?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function ComparisonColumn({ run, caseId, fixture, isLoading, focused, sampleLabel }: {
  run: TestRunDto;
  caseId: string;
  fixture: TestCaseFixtureDto | undefined;
  isLoading: boolean;
  focused: boolean;
  /** "sample i/N" shown under the endpoint name when the endpoint was sampled more than once. */
  sampleLabel?: string;
}) {
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

export function ComparisonDrawer({ runs, sampleCount = 1, caseId, caseSummary, caseIdx, total, focusEndpointId, onClose, onPrev, onNext }: Props) {
  const { t } = useLingui();

  // Order columns endpoint-major (cohort by cohort), samples within a cohort by sample index, so the
  // N samples of an endpoint sit together. Each column carries its cohort + a "sample i/N" sub-label.
  const cohorts = buildCohorts(runs);
  const columns = cohorts.flatMap(cohort => cohort.runs.map(run => ({
    run,
    endpointId: cohort.endpointId,
    sampleLabel: cohort.sampleCount > 1 ? t`sample ${run.sampleIndex + 1}/${cohort.sampleCount}` : undefined,
  })));
  const orderedRuns = columns.map(c => c.run);
  const queries = useComparisonFixtures(orderedRuns, caseId);

  // Shared context (input + expected) — identical across models for one case.
  const shared = queries.find(q => q.data)?.data;

  return (
    <DrawerShell
      widthClass={cn('w-[min(95vw,1200px)]')}
      caseId={caseId}
      caseSummary={caseSummary}
      caseIdx={caseIdx}
      total={total}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      leading={
        <span className="px-2 py-[2px] rounded-full text-caption font-semibold shrink-0 bg-accent-subtle text-accent">
          <Trans>{cohorts.length} models</Trans>{sampleCount > 1 && <> · ×{sampleCount}</>}
        </span>
      }
    >
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        {/* Shared input + expected */}
        {shared ? (
          <>
            <section>
              <div className={SECTION_LABEL}><Trans>Input</Trans></div>
              <RoleMessageList messages={shared.input.messages} />
            </section>
            <section>
              <div className={SECTION_LABEL}><Trans>Expected</Trans></div>
              <OutputBlock label={t`Expected`} color="var(--teal)" value={shared.expected} />
            </section>
          </>
        ) : (
          <Skeleton height={80} className="rounded-lg" />
        )}

        {/* Evaluator breakdown — divergent rows highlighted */}
        <EvalBreakdown runs={orderedRuns} fixtures={queries.map(q => q.data)} />

        {/* Per-sample columns, grouped by endpoint */}
        <section>
          <div className={SECTION_LABEL}><Trans>Per-model output</Trans></div>
          <div className="overflow-x-auto">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(300px, 1fr))` }}>
              {columns.map((col, i) => (
                <ComparisonColumn
                  key={col.run.id}
                  run={col.run}
                  caseId={caseId}
                  fixture={queries[i].data}
                  isLoading={queries[i].isLoading}
                  focused={col.endpointId === focusEndpointId}
                  sampleLabel={col.sampleLabel}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </DrawerShell>
  );
}
