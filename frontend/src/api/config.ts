import { api } from './client';

export interface AppConfig {
  kiosk: boolean;
  /** Whether Tracey is usable — always true outside kiosk; in kiosk only when an LLM endpoint is configured. */
  tracey: boolean;
}

export const configApi = {
  get: () => api.get<AppConfig>('/api/config'),
};
