import { api, qs } from './client';

/**
 * The browser session payload for the Tracey assistant. Mirrors the backend
 * `TraceySessionDto`: the model + Tracey agent the AI runtime uses. The runtime calls Tracey
 * same-origin (`/api/tracey/{projectId}/openai/v1`) with the app JWT — no proxy key.
 */
export interface TraceySessionDto {
  model: string;
  agentId: string;
}

export const traceyApi = {
  /** Mints a short-lived Tracey session for the current (or given) project. */
  getSession: (projectId?: string) =>
    api.get<TraceySessionDto>(`/api/tracey/session${qs({ projectId })}`),
};
