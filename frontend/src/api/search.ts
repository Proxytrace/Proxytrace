import { api } from './client';

export type SearchKind = 'agent' | 'testSuite' | 'agentCall' | 'evaluator' | 'testCase';

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

export interface SearchIndexingSettings {
  enabled: boolean;
  indexedKinds: SearchKind[];
  autoReindexOnChange: boolean;
  snippetLength: number;
}

export interface SearchIndexStatus {
  lastIndexedAt: string | null;
  documentCount: number;
  isReindexing: boolean;
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
  getSettings(projectId: string): Promise<SearchIndexingSettings> {
    return api.get<SearchIndexingSettings>(
      `/api/projects/${encodeURIComponent(projectId)}/search/settings`
    );
  },
  updateSettings(projectId: string, settings: SearchIndexingSettings): Promise<SearchIndexingSettings> {
    return api.put<SearchIndexingSettings>(
      `/api/projects/${encodeURIComponent(projectId)}/search/settings`,
      settings
    );
  },
  getStatus(projectId: string): Promise<SearchIndexStatus> {
    return api.get<SearchIndexStatus>(
      `/api/projects/${encodeURIComponent(projectId)}/search/status`
    );
  },
};
