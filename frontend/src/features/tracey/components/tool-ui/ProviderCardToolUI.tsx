import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { ServerIcon } from '../../../../components/icons';
import { Pill } from '../../../../components/ui/Pill';
import { providerColor } from '../../../../lib/colors';
import { EntityCardLink } from './EntityCardLink';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `get_provider` tool result. */
export const ProviderCardToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data: provider } = useArtifactResult('provider', result, status, isError);
  return (
    <EntityCardLink
      state={state}
      to="/settings/providers"
      title={provider?.name ?? ''}
      icon={<ServerIcon size={14} />}
      color={providerColor(provider?.name ?? '')}
      testId="tracey-provider-card"
      pendingLabel={t`Loading provider…`}
    >
      {provider && (
        <div className="flex flex-col gap-2">
          <Pill label={provider.kind} color={providerColor(provider.name)} size="sm" />
          <div className="truncate font-mono text-body-sm text-muted">{provider.endpoint}</div>
        </div>
      )}
    </EntityCardLink>
  );
};
