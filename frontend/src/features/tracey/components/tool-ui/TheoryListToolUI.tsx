import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { TargetIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { fmtPct } from '../../../../lib/format';
import { ToolUIFrame } from './ToolUIFrame';
import { THEORY_STATUS_VARIANT } from './badge-variants';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `list_theories` tool result: past hypotheses + their A/B outcomes. */
export const TheoryListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  const { state, data } = useArtifactResult('theory-list', result, status, isError);
  const theories = data ?? [];
  return (
    <ToolUIFrame
      state={state}
      icon={<TargetIcon size={14} />}
      title={t`Optimization theories`}
      pendingLabel={t`Loading theories…`}
      testId="tracey-theory-list"
    >
      {theories.length === 0 ? (
        <div className="text-body-sm text-muted"><Trans>No theories tried yet.</Trans></div>
      ) : (
        <div className="flex flex-col divide-y divide-border-subtle">
          {theories.map((theory) => (
            <div key={theory.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-title text-primary">
                  {theory.kind} · {theory.agentName}
                </div>
                <div className="truncate text-body-sm text-muted">{theory.rationale}</div>
              </div>
              {theory.baselinePassRate != null && theory.projectedPassRate != null && (
                <span className="shrink-0 font-mono text-body-sm tabular-nums text-muted">
                  {fmtPct(theory.baselinePassRate)} → {fmtPct(theory.projectedPassRate)}
                </span>
              )}
              <Badge label={theory.status} variant={THEORY_STATUS_VARIANT[theory.status]} size="sm" />
            </div>
          ))}
        </div>
      )}
    </ToolUIFrame>
  );
};
