import { api, qs, type RequestOptions } from './client';
import type { AgentAnomalyStatDto, AnomalyListItemDto, CustomAnomalyHitDto, PagedResult } from './models';
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
  /** Most-recent flagged calls, newest first, with custom-detector attributions per call. */
  recent: (params: RecentAnomaliesParams) =>
    api.get<PagedResult<AnomalyListItemDto>>(`/api/anomalies/recent${qs(params as Record<string, unknown>)}`),
  /** Custom-detector attributions for one flagged call (empty for purely statistical outliers). */
  hitsForCall: (callId: string, opts?: RequestOptions) =>
    api.get<CustomAnomalyHitDto[]>(`/api/anomalies/${callId}`, opts),
};
