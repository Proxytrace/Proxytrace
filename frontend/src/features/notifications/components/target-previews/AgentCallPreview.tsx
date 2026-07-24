import { useLingui } from '@lingui/react/macro';
import { Badge } from '../../../../components/ui/Badge';
import { NotificationTargetKind } from '../../../../api/models';
import { fmtDate, fmtLatency } from '../../../../lib/format';
import { targetRoute } from '../../notificationsMeta';
import { httpStatusVariant } from '../../targetPreviewMeta';
import { useAgentCallTarget } from '../../hooks/useNotificationTarget';
import { TargetPreviewCard, TargetPreviewRow } from './TargetPreviewCard';

/** Live summary of the captured call (trace) a notification was raised for. */
export function AgentCallPreview({ id }: { id: string }) {
  const { t } = useLingui();
  const { data: call, isPending } = useAgentCallTarget(id);

  return (
    <TargetPreviewCard
      eyebrow={t`Trace`}
      state={isPending ? 'loading' : call ? 'ready' : 'missing'}
      title={call?.model}
      route={targetRoute(NotificationTargetKind.AgentCall, id)}
      ctaLabel={t`Open trace`}
    >
      {call && (
        <>
          {call.agentName && <TargetPreviewRow label={t`Agent`} value={call.agentName} />}
          <TargetPreviewRow label={t`Provider`} value={call.provider} />
          <TargetPreviewRow
            label={t`HTTP status`}
            value={<Badge label={String(call.httpStatus)} variant={httpStatusVariant(call.httpStatus)} size="sm" />}
          />
          <TargetPreviewRow label={t`Duration`} value={fmtLatency(call.durationMs)} />
          <TargetPreviewRow label={t`Captured`} value={fmtDate(call.createdAt)} />
        </>
      )}
    </TargetPreviewCard>
  );
}
