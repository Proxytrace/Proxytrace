import { Trans, useLingui } from '@lingui/react/macro';
import { usePastEvaluation } from '../hooks/usePastEvaluation';
import { scoreAnchor } from '../testBenchMeta';
import { ScoreSquare } from './ScoreSquare';

interface Props {
  evaluatorId: string;
  evaluatorName: string;
  caseId: string | null;
}

/**
 * Search-result preview: the selected evaluator's logged verdict on top, then the test case
 * it was scored against. Scoped to the one evaluator (BEST_PRACTICES — derive at the leaf).
 */
export function PastEvaluationPreview({ evaluatorId, evaluatorName, caseId }: Props) {
  const { t } = useLingui();
  const { data, isLoading, isError } = usePastEvaluation(evaluatorId, caseId);

  if (caseId == null) return <Note><Trans>Hover or pick a past evaluation to preview it.</Trans></Note>;
  if (isLoading) return <Note><Trans>Loading…</Trans></Note>;
  if (isError || !data) return <Note><Trans>Couldn’t load this evaluation.</Trans></Note>;

  const verdict = data.loggedEvaluation;

  return (
    <div className="flex flex-col gap-3.5" data-testid="past-evaluation-preview">
      <section>
        <SectionLabel><Trans>{evaluatorName}’s verdict</Trans></SectionLabel>
        {verdict ? (
          <div className="flex gap-2.5">
            <ScoreSquare score={verdict.score} />
            <div className="min-w-0">
              <div className="text-body font-semibold text-primary">{scoreAnchor(verdict.score)}</div>
              {verdict.errorMessage ? (
                <p className="mt-1 text-body-sm leading-relaxed text-danger m-0">{verdict.errorMessage}</p>
              ) : verdict.reasoning ? (
                <p className="mt-1 text-body-sm leading-relaxed text-secondary m-0">&ldquo;{verdict.reasoning}&rdquo;</p>
              ) : (
                <p className="mt-1 text-body-sm leading-relaxed text-muted italic m-0"><Trans>No written reasoning.</Trans></p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-body-sm text-muted m-0"><Trans>This evaluator hasn’t scored this case yet.</Trans></p>
        )}
      </section>

      <section className="border-t border-hairline pt-3">
        <SectionLabel><Trans>Test case</Trans></SectionLabel>
        <div className="text-body font-semibold text-primary">{data.testCaseSummary}</div>
        <Field label={t`Expected`} value={data.expectedResponse} />
        <Field label={t`Actual`} value={data.actualResponse} />
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-caption font-semibold uppercase tracking-[0.09em] text-secondary">{children}</div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="mt-2.5">
      <div className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{label}</div>
      <pre className="mt-1 max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-card-2 px-2.5 py-2 text-body-sm leading-relaxed text-secondary font-mono m-0">
        {value}
      </pre>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="text-body-sm text-muted px-1 py-2">{children}</div>;
}
