import { api, qs } from './client';

/**
 * The browser session payload for the Tracey assistant. Mirrors the backend
 * `TraceySessionDto`: a short-lived proxy key plus the coordinates the AI runtime
 * needs to reach the ingestion proxy.
 */
export interface TraceySessionDto {
  apiKey: string;
  proxyBaseUrl: string;
  model: string;
  agentId: string;
}

export const traceyApi = {
  /** Mints a short-lived Tracey session for the current (or given) project. */
  getSession: (projectId?: string) =>
    api.get<TraceySessionDto>(`/api/tracey/session${qs({ projectId })}`),
};
