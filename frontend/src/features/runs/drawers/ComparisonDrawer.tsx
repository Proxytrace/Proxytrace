import { fmtDuration, fmtTokens, fmtCost } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';
import { Skeleton, SkeletonList } from '../../../components/ui/Skeleton';
import { compositeColor, fixtureSummary } from '../results';
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
  caseId: string;
  caseSummary?: string;
  caseIdx?: number;
  total?: number;
  focusRunId?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function ComparisonColumn({ run, caseId, fixture, isLoading, focused }: {
  run: TestRunDto;
  caseId: string;
  fixture: TestCaseFixtureDto | undefined;
  isLoading: boolean;
  focused: boolean;
}) {
  const mc = modelColor(run.endpointName);
  const { total, allPass, composite, totalCost: cost, tokensOut } = fixtureSummary(fixture);
  const failed = total > 0 && !allPass;

  const borderCls = focused
    ? ''
    : failed
      ? 'border-[color-mix(in_srgb,var(--danger)_50%,transparent)]'
      : allPass
        ? 'border-[color-mix(in_srgb,var(--success)_35%,transparent)]'
        : 'border-hairline';

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg p-3.5 border min-w-[300px] ${borderCls} ${failed ? 'bg-[color-mix(in_srgb,var(--danger)_6%,transparent)]' : 'bg-card-2'}`}
      style={focused ? { borderColor: mc } : undefined}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: mc }} />
        <span className="mono text-body font-semibold truncate flex-1 min-w-0">{run.endpointName}</span>
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
          <span className="mono text-secondary">{fmtTokens(tokensOut)} out</span>
          <span className="text-muted">·</span>
          <span className="mono text-secondary">{fmtCost(cost)}</span>
        </div>
      )}

      {isLoading && <SkeletonList rows={2} height={70} gap={6} />}

      {fixture && (
        <>
          <OutputBlock label="Actual" color={allPass ? 'var(--success)' : 'var(--danger)'} value={fixture.actual} />
          <EvaluatorList evaluators={fixture.evaluators} />
        </>
      )}

      {!isLoading && !fixture && (
        <span className="text-body-sm text-muted italic">This case was not run for this model.</span>
      )}
    </div>
  );
}

export function ComparisonDrawer({ runs, caseId, caseSummary, caseIdx, total, focusRunId, onClose, onPrev, onNext }: Props) {
  const queries = useComparisonFixtures(runs, caseId);

  // Shared context (input + expected) — identical across models for one case.
  const shared = queries.find(q => q.data)?.data;

  return (
    <DrawerShell
      widthClass="w-[min(95vw,1200px)]"
      caseId={caseId}
      caseSummary={caseSummary}
      caseIdx={caseIdx}
      total={total}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      leading={<span className="px-2 py-[2px] rounded-full text-caption font-semibold shrink-0 bg-accent-subtle text-accent">{runs.length} models</span>}
    >
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        {/* Shared input + expected */}
        {shared ? (
          <>
            <section>
              <div className={SECTION_LABEL}>Input</div>
              <RoleMessageList messages={shared.input.messages} />
            </section>
            <section>
              <div className={SECTION_LABEL}>Expected</div>
              <OutputBlock label="Expected" color="var(--teal)" value={shared.expected} />
            </section>
          </>
        ) : (
          <Skeleton height={80} className="rounded-lg" />
        )}

        {/* Evaluator breakdown — divergent rows highlighted */}
        <EvalBreakdown runs={runs} fixtures={queries.map(q => q.data)} />

        {/* Per-model columns */}
        <section>
          <div className={SECTION_LABEL}>Per-model output</div>
          <div className="overflow-x-auto">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${runs.length}, minmax(300px, 1fr))` }}>
              {runs.map((run, i) => (
                <ComparisonColumn
                  key={run.id}
                  run={run}
                  caseId={caseId}
                  fixture={queries[i].data}
                  isLoading={queries[i].isLoading}
                  focused={run.id === focusRunId}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </DrawerShell>
  );
}
