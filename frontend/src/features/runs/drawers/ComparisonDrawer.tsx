import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buildCohorts } from '../cohorts';
import { useComparisonFixtures } from '../hooks/useComparisonFixtures';
import type { TestRunDto } from '../../../api/models';
import { DrawerShell, type DrawerCase, type DrawerNav } from './DrawerShell';
import { ComparisonColumn } from './ComparisonColumn';
import { OutputBlock, RoleMessageList, EvalBreakdown, SECTION_LABEL } from './panels';

interface Props {
  runs: TestRunDto[];
  /** Samples per endpoint; >1 adds per-column "sample i/N" sub-labels. */
  sampleCount?: number;
  caseInfo: DrawerCase;
  /** Endpoint whose sample columns to highlight (the cohort cell the user clicked). */
  focusEndpointId?: string;
  nav: DrawerNav;
}

export function ComparisonDrawer({ runs, sampleCount = 1, caseInfo, focusEndpointId, nav }: Props) {
  const { t } = useLingui();
  const caseId = caseInfo.id;

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
      caseInfo={caseInfo}
      nav={nav}
      leading={
        <span className="px-2 py-0.5 rounded-none text-caption font-semibold shrink-0 bg-accent-subtle text-accent">
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
