import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../../api/agents';
import { providersApi } from '../../api/providers';
import type { AgentDto } from '../../api/models';
import { Combobox } from '../../components/ui/Combobox';
import useToast from '../../hooks/useToast';

export function EndpointSelector({ agent }: { agent: AgentDto }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();

  const { data: endpoints = [] } = useQuery({
    queryKey: ['all-endpoints'],
    queryFn: () => providersApi.getAllModels(),
  });

  const mutation = useMutation({
    mutationFn: (endpointId: string) => agentsApi.updateEndpoint(agent.id, endpointId),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'agents' });
      toast('Endpoint updated', 'success');
    },
  });

  return (
    <div data-write className="min-w-[200px]">
      <Combobox
        value={agent.endpointId}
        onChange={id => { if (id !== agent.endpointId) mutation.mutate(id); }}
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
        aria-label="Agent endpoint"
        data-testid="agent-endpoint"
      />
    </div>
  );
}
