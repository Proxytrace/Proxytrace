import { api } from './client';

export interface AppConfig {
  kiosk: boolean;
  /** Full read-write available. Always true outside kiosk; in kiosk only when an LLM endpoint is configured — also gates Tracey. */
  interactive: boolean;
  /** Running backend version (e.g. "1.0.0"); "0.0.0-dev" outside releases. */
  version: string;
  /** Public base URL of the ingestion proxy the UI advertises to clients; null when not configured. */
  proxyBaseUrl: string | null;
}

export const configApi = {
  get: () => api.get<AppConfig>('/api/config'),
};
