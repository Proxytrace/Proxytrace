import { Trans, useLingui } from '@lingui/react/macro';
import type { EvaluatorListItemDto } from '../../../api/models';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TestBenchPlayIcon } from '../../../components/icons';
import type { PlaygroundSession } from '../hooks/usePlaygroundSession';
import { CaseHeader } from './CaseHeader';
import { ConversationPanel } from './ConversationPanel';
import { ExpectedResponse, EditableResponse } from './ResponseEditor';

/** Center pane: the picked case, its conversation, the editable candidate, and the run control. */
export function BenchPane({ session, evaluator }: { session: PlaygroundSession; evaluator: EvaluatorListItemDto }) {
  const { t } = useLingui();
  const {
    effectiveCaseId, payload, payloadLoading, payloadError, payloadErrorMessage,
    conversationMessages, currentActual, originalActual, isModified,
    setActual, resetActual, run, runDisabled, runPending, runLabel,
  } = session;

  return (
    <section className="flex flex-col gap-4 min-h-0 overflow-y-auto px-0.5 pb-1">
      {effectiveCaseId == null && !payloadLoading ? (
        <EmptyState
          title={t`No past evaluations`}
          description={t`This evaluator hasn’t scored any test results yet — search for a case in the rail to load one.`}
        />
      ) : payloadLoading ? (
        <BenchSkeleton />
      ) : payloadError ? (
        <div className="p-3 rounded-md border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[var(--danger-subtle)] text-[12px] text-danger">
          {payloadErrorMessage}
        </div>
      ) : payload ? (
        <>
          <CaseHeader payload={payload} evaluator={evaluator} />
          <ConversationPanel messages={conversationMessages} />
          <div data-testid="test-bench-panes" className="flex flex-col gap-4">
            <ExpectedResponse text={payload.expectedResponse} />
            <EditableResponse
              value={currentActual}
              original={originalActual}
              onChange={setActual}
              onReset={resetActual}
            />
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-hairline shrink-0">
            <Button
              variant="primary"
              data-testid="test-bench-run"
              disabled={runDisabled}
              loading={runPending}
              leftIcon={<TestBenchPlayIcon />}
              onClick={() => run()}
            >
              {runLabel}
            </Button>
            <span className="text-body-sm text-muted flex-1 leading-relaxed">
              {isModified ? <Trans>Candidate edited — </Trans> : ''}
              <Trans>Re-score with <span className="font-mono text-secondary">{evaluator.name}</span> to see how the 1–5 verdict shifts.</Trans>
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}

/** Shaped placeholder while a case payload loads (reserves the bench layout height). */
function BenchSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton height={28} width="60%" />
      <Skeleton height={44} />
      <Skeleton height={120} />
      <Skeleton height={160} />
    </div>
  );
}
