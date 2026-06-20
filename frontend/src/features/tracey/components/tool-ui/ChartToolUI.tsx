import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { ActivityIcon } from '../../../../components/icons';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { ChartArtifact } from '../artifacts/ChartArtifact';
import { ToolUIFrame } from './ToolUIFrame';
import { useArtifactResult } from '../../useArtifact';

/** Placeholder reserving the chart's height (stat strip + plot) while it loads. */
function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} width={44} height={26} />
        ))}
      </div>
      <Skeleton height={200} />
    </div>
  );
}

/** Inline renderer for the `show_chart` tool. */
export const ChartToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data } = useArtifactResult('chart', result, status, isError);
  if (state !== 'ready' || !data) {
    return (
      <ToolUIFrame
        state={state}
        pendingLabel={t`Building chart…`}
        pendingSkeleton={<ChartSkeleton />}
        testId="tracey-chart"
      />
    );
  }
  return (
    <ToolUIFrame state="ready" title={data.title} icon={<ActivityIcon size={14} />} testId="tracey-chart">
      <ChartArtifact artifact={data} />
    </ToolUIFrame>
  );
};
