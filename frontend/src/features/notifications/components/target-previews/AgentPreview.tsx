import { Plural, useLingui } from '@lingui/react/macro';
import { NotificationTargetKind } from '../../../../api/models';
import { fmtDate } from '../../../../lib/format';
import { targetRoute } from '../../notificationsMeta';
import { useAgentTarget } from '../../hooks/useNotificationTarget';
import { TargetPreviewCard, TargetPreviewRow } from './TargetPreviewCard';

/** Live summary of the agent a notification was raised for. */
export function AgentPreview({ id }: { id: string }) {
  const { t } = useLingui();
  const { data: agent, isPending } = useAgentTarget(id);

  return (
    <TargetPreviewCard
      eyebrow={t`Agent`}
      state={isPending ? 'loading' : agent ? 'ready' : 'missing'}
      title={agent?.name}
      route={targetRoute(NotificationTargetKind.Agent, id)}
      ctaLabel={t`Open agent`}
    >
      {agent && (
        <>
          <TargetPreviewRow label={t`Model`} value={agent.endpointName} />
          <TargetPreviewRow
            label={t`Tools`}
            value={<Plural value={agent.tools.length} one="# tool" other="# tools" />}
          />
          {agent.lastUsedAt && <TargetPreviewRow label={t`Last used`} value={fmtDate(agent.lastUsedAt)} />}
        </>
      )}
    </TargetPreviewCard>
  );
}
