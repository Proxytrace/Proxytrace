import { api, qs } from './client';
import type { AgentAnomalyStatDto, AgentCallListItemDto, PagedResult } from './models';
import type { StatisticsBucket } from '../lib/time-range';

/** Query parameters for the bucketed anomaly timeline. `from`/`to` are required ISO instants.
 * A `type` (not `interface`) so it carries an implicit index signature for the {@link qs} cast. */
export type AnomalyTimelineParams = {
  from: string;
  to: string;
  bucket?: StatisticsBucket;
  agentId?: string;
  projectId?: string;
};

/** Query parameters for the paged recent-anomalies list. */
export type RecentAnomaliesParams = {
  projectId?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
};

export const anomaliesApi = {
  /** Sparse per-(bucket, agent) flagged-call counts, split into statistical vs custom-detector flags. */
  timeline: (params: AnomalyTimelineParams) =>
    api.get<AgentAnomalyStatDto[]>(`/api/statistics/anomalies/timeline${qs(params as Record<string, unknown>)}`),
  /** Most-recent flagged calls, newest first, in the traces list-item shape. */
  recent: (params: RecentAnomaliesParams) =>
    api.get<PagedResult<AgentCallListItemDto>>(`/api/anomalies/recent${qs(params as Record<string, unknown>)}`),
};
