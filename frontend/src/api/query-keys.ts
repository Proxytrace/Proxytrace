const TEST_RUN_GROUPS = 'test-run-groups';

export const QUERY_KEYS = {
  agents: (projectId?: string) => ['agents', projectId ?? null] as const,
  agentCalls: (filter: object) => ['agent-calls', filter] as const,
  agentCallsForSuiteCreate: (agentId: string, from?: string) => ['agent-calls', 'suite-create', agentId, from ?? null] as const,
  agentCallsForSuiteEdit: (agentId?: string) => ['agent-calls', 'suite-edit', agentId] as const,

  statisticsSummary: (from: string, projectId?: string) => ['statistics-summary', from, projectId ?? null] as const,
  statisticsLatency: (from?: string, agentId?: string, projectId?: string) => ['statistics-latency', from, agentId, projectId ?? null] as const,
  statisticsModelBreakdown: (from?: string, agentId?: string, projectId?: string) => ['statistics-model-breakdown', from, agentId, projectId ?? null] as const,
  statisticsAgentBreakdown: (from?: string, projectId?: string) => ['statistics-agent-breakdown', from, projectId ?? null] as const,
  statisticsTokenUsage: (from?: string, agentId?: string, projectId?: string) => ['statistics-token-usage', from, agentId, projectId ?? null] as const,
  statisticsPassRates: (from?: string, agentId?: string, projectId?: string) => ['statistics-pass-rates', from, agentId, projectId ?? null] as const,
  statisticsErrorRates: (from?: string, agentId?: string, projectId?: string) => ['statistics-error-rates', from, agentId, projectId ?? null] as const,
  statisticsCostEstimate: (from?: string, agentId?: string, projectId?: string) => ['statistics-cost-estimate', from, agentId, projectId ?? null] as const,
  statisticsLiveTelemetry: (projectId?: string) => ['statistics-live-telemetry', projectId ?? null] as const,
  statisticsTokenUsageByAgent: (from?: string, projectId?: string) => ['statistics-token-usage-by-agent', from, projectId ?? null] as const,
  statisticsDashboardTrends: (from?: string, projectId?: string) => ['statistics-dashboard-trends', from, projectId ?? null] as const,

  agentStatsOverview: (agentId: string, rangeKey: string) => ['agent-stats-overview', agentId, rangeKey] as const,
  agentSuitePassRates: (agentId: string) => ['agent-suite-pass-rates', agentId] as const,
  agentCounts: (agentId: string) => ['agent-counts', agentId] as const,

  evaluators: (projectId?: string) => ['evaluators', projectId ?? null] as const,
  statisticsEvaluatorOverview: (evaluatorId: string, rangeKey: string) => ['statistics-evaluator-overview', evaluatorId, rangeKey] as const,
  statisticsEvaluatorSparklines: (projectId: string, rangeKey: string) => ['statistics-evaluator-sparklines', projectId, rangeKey] as const,
  agenticEvaluatorPresets: ['evaluators', 'agentic-presets'] as const,
  modelEndpoints: ['model-endpoints'] as const,

  providers: ['providers'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  users: ['users'] as const,
  providerModels: (providerId: string | null) => ['provider-models', providerId] as const,
  providerAvailableModels: (providerId: string | null) => ['provider-available-models', providerId] as const,
  providerKeys: (providerId: string | null) => ['provider-keys', providerId] as const,

  testRunGroups: (agentFilter?: string, projectId?: string) => [TEST_RUN_GROUPS, agentFilter, projectId ?? null] as const,
  /** Prefix matching every test-run-groups query — use for invalidation. */
  testRunGroupsRoot: [TEST_RUN_GROUPS] as const,
  testSuites: (agentFilter?: string, projectId?: string) => ['test-suites', agentFilter, projectId ?? null] as const,
  proposals: (agentId?: string, projectId?: string) => ['proposals', agentId, projectId ?? null] as const,
  fixture: (runId: string, caseId: string) => ['fixture', runId, caseId] as const,

  search: (projectId: string, q: string) => ['search', projectId, q] as const,
  searchRecent: (projectId: string, kinds: string[], limit: number) =>
    ['search-recent', projectId, [...kinds].sort().join(','), limit] as const,
  searchSettings: (projectId: string) => ['search-settings', projectId] as const,
  searchStatus: (projectId: string) => ['search-status', projectId] as const,

  evaluatorTestBench: (evaluatorId: string, testCaseId: string) =>
    ['evaluator-test-bench', evaluatorId, testCaseId] as const,
  evaluatorTestBenchDefault: (evaluatorId: string) =>
    ['evaluator-test-bench-default', evaluatorId] as const,
  evaluatorTestBenchRecent: (evaluatorId: string, count: number) =>
    ['evaluator-test-bench-recent', evaluatorId, count] as const,
  evaluatorRecentEvaluations: (evaluatorId: string, count: number) =>
    ['evaluator-recent-evaluations', evaluatorId, count] as const,
};
