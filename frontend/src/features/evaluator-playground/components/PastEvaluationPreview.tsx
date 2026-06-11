import { useQuery } from '@tanstack/react-query';
import { evaluatorTestBenchApi } from '../../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../../api/query-keys';
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
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBench(evaluatorId, caseId ?? ''),
    queryFn: () => evaluatorTestBenchApi.load(evaluatorId, caseId ?? ''),
    enabled: evaluatorId.length > 0 && caseId != null,
    staleTime: 60_000,
    retry: false,
  });

  if (caseId == null) return <Note>Hover or pick a past evaluation to preview it.</Note>;
  if (isLoading) return <Note>Loading…</Note>;
  if (isError || !data) return <Note>Couldn&rsquo;t load this evaluation.</Note>;

  const verdict = data.loggedEvaluation;

  return (
    <div className="flex flex-col gap-3.5" data-testid="past-evaluation-preview">
      <section>
        <SectionLabel>{evaluatorName}&rsquo;s verdict</SectionLabel>
        {verdict ? (
          <div className="flex gap-2.5">
            <ScoreSquare score={verdict.score} />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-primary">{scoreAnchor(verdict.score)}</div>
              {verdict.errorMessage ? (
                <p className="mt-1 text-[11.5px] leading-relaxed text-danger m-0">{verdict.errorMessage}</p>
              ) : verdict.reasoning ? (
                <p className="mt-1 text-[11.5px] leading-relaxed text-secondary m-0">&ldquo;{verdict.reasoning}&rdquo;</p>
              ) : (
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted italic m-0">No written reasoning.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[11.5px] text-muted m-0">This evaluator hasn&rsquo;t scored this case yet.</p>
        )}
      </section>

      <section className="border-t border-hairline pt-3">
        <SectionLabel>Test case</SectionLabel>
        <div className="text-[12px] font-semibold text-primary">{data.testCaseSummary}</div>
        <Field label="Expected" value={data.expectedResponse} />
        <Field label="Actual" value={data.actualResponse} />
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">{children}</div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="mt-2.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</div>
      <pre className="mt-1 max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-card-2 px-2.5 py-2 text-[11px] leading-relaxed text-secondary font-mono m-0">
        {value}
      </pre>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] text-muted px-1 py-2">{children}</div>;
}
