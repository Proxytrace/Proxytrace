import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { AlertTriangleIcon } from '../../../../components/icons';
import { Badge, type BadgeVariant } from '../../../../components/ui/Badge';
import { EvaluationScore } from '../../../../api/models';
import type { EvaluationResultDto } from '../../../../api/models';
import { fmtPct100 } from '../../../../lib/format';
import { ToolUIFrame } from './ToolUIFrame';
import { CardOpenLink } from './CardOpenLink';
import { useArtifactResult } from '../../useArtifact';

const SCORE_VARIANT: Record<EvaluationScore, BadgeVariant> = {
  [EvaluationScore.Excellent]: 'success',
  [EvaluationScore.Good]: 'success',
  [EvaluationScore.Acceptable]: 'success',
  [EvaluationScore.Bad]: 'danger',
  [EvaluationScore.Terrible]: 'danger',
};

function EvaluationBadge({ evaluation }: { evaluation: EvaluationResultDto }) {
  if (evaluation.errorMessage) {
    return <Badge label={`${evaluation.evaluatorName}: error`} variant="danger" size="sm" title={evaluation.errorMessage} />;
  }
  if (evaluation.score == null) {
    return <Badge label={`${evaluation.evaluatorName}: —`} variant="neutral" size="sm" />;
  }
  return (
    <Badge
      label={`${evaluation.evaluatorName}: ${evaluation.score}`}
      variant={SCORE_VARIANT[evaluation.score]}
      size="sm"
      title={evaluation.reasoning ?? undefined}
    />
  );
}

/** Inline renderer for the `get_run_failures` tool result: the run's failing cases in detail. */
export const RunFailuresToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { state, data } = useArtifactResult('run-failures', result, status, isError);
  return (
    <ToolUIFrame
      state={state}
      icon={<AlertTriangleIcon size={14} />}
      title={data ? `Failing cases · ${data.suiteName ?? data.agentName}` : 'Failing cases'}
      cornerAccessory={data ? <CardOpenLink to={`/runs?run=${data.runId}`} /> : undefined}
      pendingLabel="Analyzing run…"
      testId="tracey-run-failures"
    >
      {data && (
        <div className="flex flex-col gap-3">
          <div className="text-body-sm text-muted">
            {data.failures.length} of {data.totalCases} cases failing ·{' '}
            <span className="font-mono tabular-nums">{fmtPct100(data.passRate)}</span> pass rate
          </div>
          {data.failures.length === 0 ? (
            <div className="text-body-sm text-success">All cases passed.</div>
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle">
              {data.failures.map((failure) => (
                <div key={failure.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                  <div className="text-title text-primary">{failure.testCaseSummary}</div>
                  <div className="line-clamp-2 border-l-2 border-border pl-2.5 font-mono text-body-sm text-secondary">
                    {failure.actualResponse || '(empty response)'}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {failure.evaluations.map((evaluation) => (
                      <EvaluationBadge key={evaluation.evaluatorId} evaluation={evaluation} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ToolUIFrame>
  );
};
