import { api } from './client';

export interface AppConfig {
  kiosk: boolean;
}

export const configApi = {
  get: () => api.get<AppConfig>('/api/config'),
};
