import { api } from './client';

export interface AppConfig {
  kiosk: boolean;
  /** Full read-write available. Always true outside kiosk; in kiosk only when an LLM endpoint is configured — also gates Tracey. */
  interactive: boolean;
}

export const configApi = {
  get: () => api.get<AppConfig>('/api/config'),
};
