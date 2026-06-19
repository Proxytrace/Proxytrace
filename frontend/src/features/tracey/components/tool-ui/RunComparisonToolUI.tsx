import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { Plural, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import { GitCompareIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { fmtPct100 } from '../../../../lib/format';
import type { CaseMovement } from '../../tools/run-analysis';
import { ToolUIFrame } from './ToolUIFrame';
import { StatGrid } from './StatGrid';
import { useArtifactResult } from '../../useArtifact';

const MOVEMENT_LABEL: Record<Exclude<CaseMovement, 'still-passing'>, { label: MessageDescriptor; variant: 'success' | 'danger' | 'neutral' }> = {
  fixed: { label: msg`Fixed`, variant: 'success' },
  regressed: { label: msg`Regressed`, variant: 'danger' },
  'still-failing': { label: msg`Still failing`, variant: 'neutral' },
};

/** Inline renderer for the `compare_runs` tool result: per-case movement between two runs. */
export const RunComparisonToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t, i18n } = useLingui();
  const { state, data } = useArtifactResult('run-comparison', result, status, isError);
  const moved = (data?.cases ?? []).filter((c) => c.movement !== 'still-passing');
  return (
    <ToolUIFrame
      state={state}
      icon={<GitCompareIcon size={14} />}
      title={data ? t`Run comparison · ${data.suiteName ?? ''}` : t`Run comparison`}
      pendingLabel={t`Comparing runs…`}
      testId="tracey-run-comparison"
    >
      {data && (
        <div className="flex flex-col gap-3">
          <div className="text-body-sm text-secondary">
            <span className="font-mono tabular-nums">{fmtPct100(data.baseline.passRate)}</span>
            {' → '}
            <span className="font-mono tabular-nums text-primary">{fmtPct100(data.candidate.passRate)}</span>
            <span className="text-muted">
              {' '}· {data.baseline.endpointName === data.candidate.endpointName
                ? data.candidate.endpointName
                : `${data.baseline.endpointName} → ${data.candidate.endpointName}`}
            </span>
          </div>
          <StatGrid
            items={[
              { label: t`Fixed`, value: String(data.fixed) },
              { label: t`Regressed`, value: String(data.regressed) },
              { label: t`Still failing`, value: String(data.stillFailing) },
            ]}
          />
          {moved.length > 0 && (
            <div className="flex flex-col divide-y divide-border-subtle">
              {moved.map((item) => (
                <div key={item.testCaseId} className="flex items-center gap-2.5 py-1.5 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">{item.summary}</span>
                  <Badge
                    label={i18n._(MOVEMENT_LABEL[item.movement as keyof typeof MOVEMENT_LABEL].label)}
                    variant={MOVEMENT_LABEL[item.movement as keyof typeof MOVEMENT_LABEL].variant}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
          {data.unmatched > 0 && (
            <div className="text-body-sm text-muted">
              <Plural
                value={data.unmatched}
                one="# case not comparable (suite changed between runs)."
                other="# cases not comparable (suite changed between runs)."
              />
            </div>
          )}
        </div>
      )}
    </ToolUIFrame>
  );
};
