export const QUERY_KEYS = {
  agents: (projectId?: string) => ['agents', projectId ?? null] as const,
  agentCalls: (filter: object) => ['agent-calls', filter] as const,
  agentCallsForSuiteCreate: (agentId: string, from?: string) => ['agent-calls', 'suite-create', agentId, from ?? null] as const,
  agentCallsForSuiteEdit: (agentId?: string) => ['agent-calls', 'suite-edit', agentId] as const,

  statisticsSummary: (from: string, projectId?: string) => ['statistics-summary', from, projectId ?? null] as const,
  statisticsLatency: (from?: string, agentId?: string, projectId?: string) => ['statistics-latency', from, agentId, projectId ?? null] as const,
  statisticsModelBreakdown: (from?: string, agentId?: string, projectId?: string) => ['statistics-model-breakdown', from, agentId, projectId ?? null] as const,
  statisticsAgentBreakdown: (from?: string, projectId?: string) => ['statistics-agent-breakdown', from, projectId ?? null] as const,

  agentStatsOverview: (agentId: string, rangeKey: string) => ['agent-stats-overview', agentId, rangeKey] as const,
  agentSuitePassRates: (agentId: string) => ['agent-suite-pass-rates', agentId] as const,
  agentCounts: (agentId: string) => ['agent-counts', agentId] as const,

  evaluators: (projectId?: string) => ['evaluators', projectId ?? null] as const,
  modelEndpoints: ['model-endpoints'] as const,

  providers: ['providers'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  users: ['users'] as const,
  providerModels: (providerId: string | null) => ['provider-models', providerId] as const,
  providerAvailableModels: (providerId: string | null) => ['provider-available-models', providerId] as const,
  providerKeys: (providerId: string | null) => ['provider-keys', providerId] as const,

  testRunGroups: (agentFilter?: string, projectId?: string) => ['test-run-groups', agentFilter, projectId ?? null] as const,
  testSuites: (agentFilter?: string, projectId?: string) => ['test-suites', agentFilter, projectId ?? null] as const,
  proposals: (agentId?: string, projectId?: string) => ['proposals', agentId, projectId ?? null] as const,
  fixture: (runId: string, caseId: string) => ['fixture', runId, caseId] as const,
};
