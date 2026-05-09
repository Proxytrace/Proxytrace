import { api } from './client';

export type SearchKind = 'agent' | 'testSuite' | 'agentCall' | 'evaluator';

export interface SearchHit {
  kind: SearchKind;
  entityId: string;
  title: string;
  snippet: string;
  score: number;
  metadata: Record<string, string>;
}

export interface SearchResponse {
  hits: SearchHit[];
}

export const searchApi = {
  search(projectId: string, q: string): Promise<SearchResponse> {
    return api.get<SearchResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/search?q=${encodeURIComponent(q)}`
    );
  },
  reindex(projectId: string): Promise<unknown> {
    return api.post(`/api/projects/${encodeURIComponent(projectId)}/search/reindex`);
  },
};
