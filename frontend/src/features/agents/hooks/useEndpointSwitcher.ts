import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import { providersApi } from '../../../api/providers';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { AgentDto } from '../../../api/models';
import useToast from '../../../hooks/useToast';

interface Options {
  agent: AgentDto;
  enabled: boolean;
  onSuccess?: () => void;
}

/**
 * Endpoint switcher data layer for `EndpointSelector`.
 *
 * - Lazily fetches the list of model endpoints (gated by `enabled` so the query
 *   stays cold until the user opens the dropdown).
 * - Exposes a `switchEndpoint` mutation that updates the agent's endpoint, then
 *   invalidates every `agents(...)` query via TanStack Query's hierarchical
 *   prefix match on `['agents']` (per BEST_PRACTICES §3.2).
 */
export function useEndpointSwitcher({ agent, enabled, onSuccess }: Options) {
  const qc = useQueryClient();
  const { show: toast } = useToast();

  const endpointsQuery = useQuery({
    queryKey: QUERY_KEYS.modelEndpoints,
    queryFn: () => providersApi.getAllModels(),
    enabled,
  });

  const switchMutation = useMutation({
    mutationFn: (endpointId: string) => agentsApi.updateEndpoint(agent.id, endpointId),
    onSuccess: () => {
      // Prefix match every `agents(...)` query — see QUERY_KEYS.agents.
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast('Endpoint updated', 'success');
      onSuccess?.();
    },
  });

  return {
    endpoints: endpointsQuery.data ?? [],
    isLoading: endpointsQuery.isLoading,
    switchEndpoint: switchMutation.mutate,
    isSwitching: switchMutation.isPending,
  };
}
