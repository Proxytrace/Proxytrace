export const QUERY_KEYS = {
  agents: ['agents'] as const,
  agentCalls: (filter: object) => ['agent-calls', filter] as const,
  agentCallsForSuiteCreate: (agentId: string) => ['agent-calls', 'suite-create', agentId] as const,
  agentCallsForSuiteEdit: (agentId?: string) => ['agent-calls', 'suite-edit', agentId] as const,

  statisticsSummary: (from: string) => ['statistics-summary', from] as const,
  statisticsLatency: (from?: string, agentId?: string) => ['statistics-latency', from, agentId] as const,
  statisticsModelBreakdown: (from?: string, agentId?: string) => ['statistics-model-breakdown', from, agentId] as const,

  evaluators: ['evaluators'] as const,
  modelEndpoints: ['model-endpoints'] as const,

  providers: ['providers'] as const,
  projects: ['projects'] as const,
  providerModels: (providerId: string | null) => ['provider-models', providerId] as const,
  providerKeys: (providerId: string | null) => ['provider-keys', providerId] as const,

  testRunGroups: (agentFilter?: string) => ['test-run-groups', agentFilter] as const,
  testSuites: (agentFilter?: string) => ['test-suites', agentFilter] as const,
  fixture: (runId: string, caseId: string) => ['fixture', runId, caseId] as const,
};
