import { useLingui } from '@lingui/react/macro';
import type { AgentDto } from '../../api/models';
import { Combobox } from '../../components/ui/Combobox';
import useModelEndpoints from '../../hooks/useModelEndpoints';
import useToast from '../../hooks/useToast';
import { useUpdateAgentEndpoint } from './hooks/useAgents';

export function EndpointSelector({ agent }: { agent: AgentDto }) {
  const { t } = useLingui();
  const { show: toast } = useToast();
  const { data: endpoints = [] } = useModelEndpoints();
  const mutation = useUpdateAgentEndpoint(agent.id);

  return (
    <div data-write className="min-w-[200px]">
      <Combobox
        value={agent.endpointId}
        onChange={id => {
          if (id !== agent.endpointId) {
            mutation.mutate(id, { onSuccess: () => toast(t`Endpoint updated`, 'success') });
          }
        }}
        items={endpoints}
        itemKey={ep => ep.id}
        itemLabel={ep => ep.modelName}
        renderItem={ep => (
          <span className="flex flex-col min-w-0">
            <span className="font-mono text-body font-semibold text-primary truncate">{ep.modelName}</span>
            <span className="text-body-sm text-muted truncate">{ep.providerName}</span>
          </span>
        )}
        placeholder={agent.endpointName}
        inputSize="sm"
        aria-label={t`Agent endpoint`}
        data-testid="agent-endpoint"
      />
    </div>
  );
}
