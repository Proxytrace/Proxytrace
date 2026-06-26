import { api } from './client';

/** Operator-tunable sensitivity for ingestion-time outlier detection. */
export interface OutlierSettings {
  enabled: boolean;
  /** Standard deviations from the agent's recent mean before a metric is flagged (mean ± N·stddev). */
  sigmaMultiplier: number;
  /** Minimum recent samples a metric needs before it is evaluated (cold-start guard). */
  minSampleCount: number;
  /** How many of the agent's most recent successful calls form the baseline. */
  sampleWindow: number;
}

export const outlierSettingsApi = {
  /** GET always returns settings — the active defaults when none have been saved. */
  get: () => api.get<OutlierSettings>(`/api/outlier-settings`),
  update: (body: OutlierSettings) => api.put<OutlierSettings>(`/api/outlier-settings`, body),
};
