import { fmtDuration, fmtTokens } from '../../../lib/format';
import { Skeleton, SkeletonList } from '../../../components/ui/Skeleton';
import { compositeColor, fixtureSummary } from '../results';
import { useFixture } from '../hooks/useFixture';
import { DrawerShell } from './DrawerShell';
import {
  OutputBlock,
  PassFailTag,
  EvaluatorList,
  RuntimePanel,
  CostPanel,
  RoleMessageList,
  SECTION_LABEL,
} from './panels';

interface Props {
  runId: string;
  caseId: string;
  caseIdx?: number;
  total?: number;
  caseSummary?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function FixtureDrawer({ runId, caseId, caseIdx, total, caseSummary, onClose, onPrev, onNext }: Props) {
  const { fixture, isLoading } = useFixture(runId, caseId);
  const { passed, total: evalTotal, allPass, composite, totalCost, totalTokens } = fixtureSummary(fixture);

  const metrics = fixture
    ? [
        { label: 'Composite score', value: composite != null ? `${composite}%` : '—', sub: `${passed}/${evalTotal} evaluators`, color: compositeColor(composite) },
        { label: 'Runtime', value: fmtDuration(fixture.runtime.total), sub: undefined, color: 'var(--text-primary)' },
        { label: 'Cost', value: `$${totalCost.toFixed(4)}`, sub: undefined, color: 'var(--text-primary)' },
        { label: 'Tokens', value: fmtTokens(totalTokens), sub: undefined, color: 'var(--text-primary)' },
      ]
    : [];

  return (
    <DrawerShell
      widthClass="w-[720px] max-w-[95vw]"
      caseId={caseId}
      caseSummary={caseSummary}
      caseIdx={caseIdx}
      total={total}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      leading={fixture && (
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: allPass ? 'var(--success)' : 'var(--danger)', boxShadow: `0 0 8px ${allPass ? 'var(--success)' : 'var(--danger)'}88` }}
        />
      )}
      trailing={fixture && <PassFailTag pass={allPass} size="md" />}
    >
      {/* Metric band */}
      {fixture && (
        <div className="grid grid-cols-4 shrink-0 border-b border-hairline">
          {metrics.map((m, i) => (
            <div key={m.label} className={`px-4 py-3 ${i < 3 ? 'border-r border-hairline' : ''}`}>
              <div className="text-body-sm text-muted font-medium mb-1">{m.label}</div>
              <div className="text-h1 font-bold tracking-[-0.02em]" style={{ color: m.color }}>{m.value}</div>
              {m.sub && <div className="text-body-sm text-muted mt-0.5">{m.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        {isLoading && (
          <div className="flex flex-col gap-4">
            <Skeleton height={20} width="40%" className="rounded-sm" />
            <SkeletonList rows={3} height={62} gap={6} />
            <Skeleton height={20} width="40%" className="rounded-sm" />
            <SkeletonList rows={2} height={62} gap={6} />
          </div>
        )}

        {fixture && (
          <>
            <section>
              <div className={SECTION_LABEL}>Input</div>
              <RoleMessageList messages={fixture.input.messages} />
            </section>

            <section>
              <div className={SECTION_LABEL}>Output</div>
              <div className="flex gap-3">
                <OutputBlock label="Expected" color="var(--teal)" value={fixture.expected} />
                <OutputBlock label="Actual" color="var(--success)" value={fixture.actual} />
              </div>
            </section>

            {fixture.evaluators.length > 0 && (
              <section>
                <div className={SECTION_LABEL}>
                  Evaluations <span className="mono text-caption text-muted font-normal">({passed}/{evalTotal})</span>
                </div>
                <EvaluatorList evaluators={fixture.evaluators} />
              </section>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="px-4 py-3.5 rounded-xl bg-card-2">
                <RuntimePanel runtime={fixture.runtime} />
              </div>
              {fixture.endpoints.length > 0 && (
                <div className="px-4 py-3.5 rounded-xl bg-card-2">
                  <CostPanel endpoints={fixture.endpoints} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DrawerShell>
  );
}
