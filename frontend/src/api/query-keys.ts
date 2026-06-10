const TEST_RUN_GROUPS = 'test-run-groups';

export const QUERY_KEYS = {
  agents: (projectId?: string) => ['agents', projectId ?? null] as const,
  agent: (id: string | null) => ['agent', id ?? null] as const,
  agentVersions: (agentId: string) => ['agent', agentId, 'versions'] as const,
  agentVersion: (versionId: string) => ['agent-version', versionId] as const,
  agentCalls: (filter: object) => ['agent-calls', filter] as const,
  /** Prefix matching every agent-calls query — use for invalidation. */
  agentCallsRoot: ['agent-calls'] as const,
  agentCallsOverview: (from?: string, agentId?: string, projectId?: string) => ['agent-calls', 'overview', from, agentId, projectId ?? null] as const,
  agentCallsHistogram: (filter: object) => ['agent-calls', 'histogram', filter] as const,
  agentCallsForSuiteCreate: (agentId: string, from?: string) => ['agent-calls', 'suite-create', agentId, from ?? null] as const,
  agentCallsForSuiteEdit: (agentId?: string) => ['agent-calls', 'suite-edit', agentId] as const,

  statisticsDashboard: (from: string | undefined, projectId?: string) => ['statistics-dashboard', from ?? null, projectId ?? null] as const,
  statisticsPassRates: (from?: string, agentId?: string, projectId?: string) => ['statistics-pass-rates', from, agentId, projectId ?? null] as const,
  statisticsErrorRates: (from?: string, agentId?: string, projectId?: string) => ['statistics-error-rates', from, agentId, projectId ?? null] as const,
  statisticsCostEstimate: (from?: string, agentId?: string, projectId?: string) => ['statistics-cost-estimate', from, agentId, projectId ?? null] as const,

  agentStatsOverview: (agentId: string, rangeKey: string) => ['agent-stats-overview', agentId, rangeKey] as const,
  agentSuitePassRates: (agentId: string) => ['agent-suite-pass-rates', agentId] as const,
  agentCounts: (agentId: string) => ['agent-counts', agentId] as const,

  evaluators: (projectId?: string) => ['evaluators', projectId ?? null] as const,
  evaluatorsOverview: (projectId: string, rangeKey: string) => ['evaluators', 'overview', projectId, rangeKey] as const,
  evaluatorDetail: (evaluatorId: string, rangeKey: string) => ['evaluators', 'detail', evaluatorId, rangeKey] as const,
  evaluatorRecent: (evaluatorId: string, score: string, count: number) => ['evaluators', 'recent', evaluatorId, score, count] as const,
  agenticEvaluatorPresets: ['evaluators', 'agentic-presets'] as const,
  modelEndpoints: ['model-endpoints'] as const,

  license: ['license'] as const,
  health: ['health'] as const,
  authMode: ['auth-mode'] as const,
  appConfig: ['app-config'] as const,
  setupStatus: ['setup-status'] as const,
  invites: ['invites'] as const,
  providers: ['providers'] as const,
  providersOverview: ['providers', 'overview'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  users: ['users'] as const,
  providerAvailableModels: (providerId: string | null) => ['provider-available-models', providerId] as const,

  testRunGroups: (agentFilter?: string, projectId?: string, includeSystem?: boolean) =>
    [TEST_RUN_GROUPS, agentFilter, projectId ?? null, includeSystem ?? false] as const,
  /** A single test-run group — used by Tracey's live run-progress card. */
  testRunGroup: (id: string) => [TEST_RUN_GROUPS, 'detail', id] as const,
  /** Prefix matching every test-run-groups query — use for invalidation. */
  testRunGroupsRoot: [TEST_RUN_GROUPS] as const,
  testSuites: (agentFilter?: string, projectId?: string) => ['test-suites', agentFilter, projectId ?? null] as const,
  proposals: (agentId?: string, projectId?: string) => ['proposals', agentId, projectId ?? null] as const,
  theories: (agentId?: string, projectId?: string, status?: string) => ['theories', agentId, projectId ?? null, status ?? null] as const,
  theory: (id: string) => ['theory', id] as const,
  fixture: (runId: string, caseId: string) => ['fixture', runId, caseId] as const,
  fixtureRequest: (runId: string, caseId: string) => ['fixture-request', runId, caseId] as const,

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

  traceySession: (projectId?: string) => ['tracey-session', projectId ?? null] as const,

  errorLog: (filter: object) => ['error-log', filter] as const,
  /** Prefix matching every error-log query — use for invalidation. */
  errorLogRoot: ['error-log'] as const,
};
