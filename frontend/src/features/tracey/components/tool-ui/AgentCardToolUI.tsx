import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Avatar } from '../../../../components/ui/Avatar';
import { Pill } from '../../../../components/ui/Pill';
import { Badge } from '../../../../components/ui/Badge';
import { agentColor, modelColor } from '../../../../lib/colors';
import { fmtRelative } from '../../../../lib/format';
import { EntityCardLink } from './EntityCardLink';
import { useArtifactResult } from '../../useArtifact';

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption uppercase tracking-[0.06em] text-secondary">{label}</span>
      <span className="truncate font-mono text-body-sm tabular-nums text-primary">{value}</span>
    </div>
  );
}

/** Inline renderer for the `get_agent` tool result. */
export const AgentCardToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data: agent } = useArtifactResult('agent', result, status, isError);
  const promptPreview = agent?.systemMessage.trim() ?? '';
  return (
    <EntityCardLink
      state={state}
      to={agent ? `/agents?id=${agent.id}` : '/agents'}
      title={agent?.name ?? ''}
      icon={
        <Avatar
          initials={initialsOf(agent?.name ?? '')}
          color={agentColor(agent?.id ?? '')}
          className="h-7 w-7 rounded-md text-caption"
        />
      }
      color={agentColor(agent?.id ?? '')}
      testId="tracey-agent-card"
      pendingLabel={t`Loading agent…`}
    >
      {agent && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill label={agent.endpointName} color={modelColor(agent.endpointName)} size="sm" />
            {agent.isSystemAgent && <Badge label={t`System`} variant="accent" size="sm" />}
          </div>
          <div className="grid grid-cols-3 gap-x-4">
            <MetaItem label={t`Tools`} value={String(agent.tools.length)} />
            <MetaItem
              label={t`Last used`}
              value={agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : t`never`}
            />
            <MetaItem label={t`Created`} value={fmtRelative(agent.createdAt)} />
          </div>
          {promptPreview && (
            <div className="border-l-2 border-border pl-2.5">
              <div className="text-caption uppercase tracking-[0.06em] text-secondary"><Trans>System prompt</Trans></div>
              <p className="mt-0.5 line-clamp-2 text-body-sm leading-relaxed text-secondary">
                {promptPreview}
              </p>
            </div>
          )}
        </div>
      )}
    </EntityCardLink>
  );
};
