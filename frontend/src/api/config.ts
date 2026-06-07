import { api } from './client';

export interface AppConfig {
  kiosk: boolean;
  /** Full read-write — always true outside kiosk; in kiosk only when an LLM endpoint is configured. */
  interactive: boolean;
}

export const configApi = {
  get: () => api.get<AppConfig>('/api/config'),
};
