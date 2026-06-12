import { resolveProxyBase } from '../lib/ingestion';
import { useAppConfig } from './useAppConfig';

/**
 * Base URL of the ingestion proxy to show to users, preferring the
 * backend-advertised `proxyBaseUrl` from `/api/config`. Pass the result to
 * `ingestionUrl(projectName, base)` for a project's full OpenAI base_url.
 */
export function useIngestionBase(): string {
  const { data } = useAppConfig();
  return resolveProxyBase(data?.proxyBaseUrl);
}
