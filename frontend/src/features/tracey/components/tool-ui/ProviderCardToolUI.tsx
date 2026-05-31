import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ServerIcon } from '../../../../components/icons';
import { Pill } from '../../../../components/ui/Pill';
import { providerColor } from '../../../../lib/colors';
import type { ProviderDto } from '../../../../api/models';
import { EntityCardLink } from './EntityCardLink';
import { toolUiState } from './tool-ui-state';

/** Inline renderer for the `get_provider` tool result. */
export const ProviderCardToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  const provider = result as ProviderDto | undefined;
  return (
    <EntityCardLink
      state={state}
      to="/providers"
      title={provider?.name ?? ''}
      icon={<ServerIcon size={14} />}
      color={providerColor(provider?.name ?? '')}
      testId="tracey-provider-card"
      pendingLabel="Loading provider…"
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
