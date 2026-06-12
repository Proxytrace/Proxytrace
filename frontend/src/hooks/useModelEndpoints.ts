import { useQuery } from '@tanstack/react-query';
import { providersApi } from '../api/providers';
import { QUERY_KEYS } from '../api/query-keys';

/**
 * Every configured model endpoint across providers — shared by the endpoint pickers
 * (agents, playground, run dialog, project settings). One cache entry under
 * `QUERY_KEYS.modelEndpoints` for all of them.
 */
export default function useModelEndpoints(enabled = true) {
  return useQuery({ queryKey: QUERY_KEYS.modelEndpoints, queryFn: providersApi.getAllModels, enabled });
}
