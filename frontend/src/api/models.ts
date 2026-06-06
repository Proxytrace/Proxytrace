export enum TestRunStatus {
  Pending = 'Pending',
  Running = 'Running',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
}

export enum EvaluationScore { Terrible = 'Terrible', Bad = 'Bad', Acceptable = 'Acceptable', Good = 'Good', Excellent = 'Excellent' }

export enum EvaluatorKind {
  Agentic = 'Agentic',
  ExactMatch = 'ExactMatch',
  NumericMatch = 'NumericMatch',
  JsonSchemaMatch = 'JsonSchemaMatch',
}

export interface AgenticEvaluatorPresetDto {
  key: string;
  name: string;
  systemPrompt: string;
}

export enum ModelProviderKind {
  Unknown = 'Unknown',
  Anthropic = 'Anthropic',
  OpenAi = 'OpenAi',
  OpenAiCompatible = 'OpenAiCompatible',
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ── Agent Calls ── */
export interface ToolRequestDto {
  id: string;
  name: string;
  arguments: string;
}
export interface MessageDto {
  role: string;
  content: string;
  toolRequests: ToolRequestDto[];
  toolCallId: string | null;
}
export interface ToolArgumentDto {
  name: string;
  description: string | null;
  type: string;
  isRequired: boolean;
  enumValues: string[] | null;
}
export interface ToolSpecDto {
  name: string;
  description: string;
  arguments: ToolArgumentDto[];
}
export interface ModelParametersDto {
  temperature: number | null;
  topP: number | null;
  reasoningEffort: string | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  maxTokens: number | null;
  seed: number | null;
  stop: string[] | null;
  n: number | null;
}
export interface AgentCallDto {
  id: string;
  agentId: string | null;
  agentName: string | null;
  model: string;
  provider: string;
  request: MessageDto[];
  /** Null when the captured call produced no completion (HTTP error, empty/dropped completion). */
  response: MessageDto | null;
  tools: ToolSpecDto[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  httpStatus: number;
  finishReason: string | null;
  errorMessage: string | null;
  costEur: number | null;
  modelParameters: ModelParametersDto;
  createdAt: string;
  updatedAt: string;
  conversationId: string | null;
}

/* ── Agents ── */
export interface AgentDto {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  systemMessage: string;
  tools: ToolSpecDto[];
  endpointId: string;
  endpointName: string;
  modelParameters: ModelParametersDto;
  isSystemAgent: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface AgentVersionDto {
  id: string;
  agentId: string;
  versionNumber: number;
  systemMessage: string;
  tools: ToolSpecDto[];
  fingerprint: string;
  createdAt: string;
}

/* ── Statistics ── */
/** Filter-bar metadata for the Traces page (agents, per-agent counts, latency). */
export interface TracesOverviewDto {
  agents: AgentDto[];
  agentBreakdown: AgentBreakdownDto[];
  latency: LatencyStatDto[];
}
/** Single-call dashboard payload bundling every widget's data. */
export interface DashboardViewDto {
  summary: SummaryDto;
  liveTelemetry: LiveTelemetryDto;
  trends: DashboardTrendsDto;
  agentBreakdown: AgentBreakdownDto[];
  latency: LatencyStatDto[];
  modelBreakdown: ModelBreakdownDto[];
  tokenUsage: TokenUsageDto[];
  tokenUsageByAgent: AgentTokenUsageDto[];
  recentTraces: AgentCallDto[];
  agents: AgentDto[];
}
export interface SummaryDto {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgLatencyMs: number;
  overallPassRate: number | null;
}
export interface ModelBreakdownDto {
  endpointId: string;
  modelName: string;
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgDurationMs: number;
}
export interface AgentBreakdownDto {
  agentId: string;
  callCount: number;
}
export interface LiveTelemetryDto {
  tracesPerMinute: number;
  tokensPerSecond: number;
  queueDepth: number;
  errorRate: number;
  p95Ms: number;
  proxyVersion: string;
}
export interface AgentTokenUsageDto {
  bucketStart: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
}
export interface DashboardTrendsDto {
  traces: number[];
  latencyMs: number[];
  throughput: number[];
  passRate: number[];
}
export interface LatencyStatDto {
  endpointId: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  sampleCount: number;
}
export interface TokenUsageDto {
  bucketStart: string;
  endPointId: string;
  inputTokens: number;
  outputTokens: number;
}
export interface PassRateDto {
  suiteId: string;
  runTimestamp: string;
  passCount: number;
  failCount: number;
}
export interface ErrorRateDto {
  endpointId: string;
  totalCalls: number;
  errorCalls: number;
  errorRate: number;
}
export interface CostEstimateDto {
  endpointId: string;
  inputCostEur: number | null;
  outputCostEur: number | null;
  totalCostEur: number | null;
}

/* ── Agent Statistics ── */
export interface AgentTimeSeriesPointDto {
  bucketStart: string;
  traceCount: number;
  inputTokens: number;
  outputTokens: number;
  costEur: number;
  avgLatencyMs: number;
}
export interface AgentPassRatePointDto {
  bucketStart: string;
  passed: number;
  testCases: number;
}
export interface AgentSuitePassRateDto {
  suiteId: string;
  suiteName: string;
  latestRunAt: string;
  passed: number;
  testCases: number;
}
export interface AgentEntityCountsDto {
  suiteCount: number;
  testCaseCount: number;
  openProposalCount: number;
  totalProposalCount: number;
}
export interface AgentTimeSummaryDto {
  totalTraces: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostEur: number;
  avgLatencyMs: number;
}
export interface AgentOverviewDto {
  summary: AgentTimeSummaryDto;
  timeSeries: AgentTimeSeriesPointDto[];
  passRateTrend: AgentPassRatePointDto[];
  suitePassRates: AgentSuitePassRateDto[];
  counts: AgentEntityCountsDto;
}

/* ── Test Suites ── */
export interface ToolRequestInputDto { name: string; arguments: string; }
export interface TestSuiteMessageDto {
  role: string;
  content: string;
  toolRequests?: ToolRequestInputDto[] | null;
}
export interface TestCaseDto {
  id: string;
  input: TestSuiteMessageDto[];
  expectedOutput: TestSuiteMessageDto;
}
export interface SuiteEvaluatorDto { id: string; kind: EvaluatorKind; }
export interface TestSuiteDto {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  evaluators: SuiteEvaluatorDto[];
  testCases: TestCaseDto[];
  description: string | null;
  tags: string[];
  totalRuns: number;
  passRate: number | null;
  prevPassRate: number | null;
  passRateTrend: number[];
  lastRunAt: string | null;
  lastRunGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Test Runs ── */
export interface EvaluatorSummaryDto {
  totalEvaluations: number;
  avgScore: number | null;
  overallPassRate: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalCost: number | null;
  avgLatencyMs: number | null;
}

export interface EvaluatorCostPointDto {
  bucketStart: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  avgLatencyMs: number;
}

export interface EvaluatorPassRatePointDto {
  bucketStart: string;
  passed: number;
  total: number;
}

export interface EvaluatorScoreBucketDto {
  score: EvaluationScore;
  count: number;
}

export interface EvaluatorOverviewDto {
  summary: EvaluatorSummaryDto;
  passRateTrend: EvaluatorPassRatePointDto[];
  scoreDistribution: EvaluatorScoreBucketDto[];
  costTrend: EvaluatorCostPointDto[];
}

export interface EvaluatorSparklineDto {
  evaluatorId: string;
  points: EvaluatorPassRatePointDto[];
}

export interface EvaluationResultDto {
  evaluatorId: string;
  evaluatorKind: EvaluatorKind;
  evaluatorName: string;
  score: EvaluationScore | null;
  reasoning: string | null;
  errorMessage: string | null;
}
export interface TestResultDto {
  id: string;
  testCaseId: string;
  testCaseSummary: string;
  actualResponse: string;
  evaluations: EvaluationResultDto[];
  durationMs: number;
}
export interface TestCaseRowDto { id: string; summary: string; }
export interface RunEvaluatorDto { id: string; kind: EvaluatorKind; name: string; }
export interface TestRunDto {
  id: string;
  groupId: string;
  suiteId: string | null;
  suiteName: string | null;
  agentId: string;
  agentName: string;
  endpointId: string;
  endpointName: string;
  status: TestRunStatus;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  /** Run-level totals aggregated across every test result (null until completed). */
  costUsd: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  evaluators: RunEvaluatorDto[];
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  testCases: TestCaseRowDto[];
  results: TestResultDto[];
  createdAt: string;
  updatedAt: string;
}
export interface TestRunGroupDto {
  id: string;
  suiteId: string;
  suiteName: string;
  agentId: string;
  agentName: string;
  status: TestRunStatus;
  completedAt: string | null;
  runs: TestRunDto[];
  createdAt: string;
  updatedAt: string;
}

/* ── Evaluators ── */
export interface EvaluatorDetailDto {
  id: string;
  kind: EvaluatorKind;
  name: string;
  systemMessage: string | null;
  projectId: string;
  projectName: string;
  endpointId: string | null;
  endpointName: string | null;
  agentId: string | null;
  jsonSchema: string | null;
  extractionPattern: string | null;
  tolerance: number | null;
  createdAt: string;
  updatedAt: string;
}
export type CreateEvaluatorPayload =
  | { kind: EvaluatorKind.Agentic; projectId: string; name: string; systemMessage: string }
  | { kind: EvaluatorKind.ExactMatch; projectId: string }
  | { kind: EvaluatorKind.NumericMatch; projectId: string; extractionPattern: string; tolerance: number }
  | { kind: EvaluatorKind.JsonSchemaMatch; projectId: string; jsonSchema: string };

export type UpdateEvaluatorPayload =
  | { kind: EvaluatorKind.Agentic; name?: string; systemMessage?: string }
  | { kind: EvaluatorKind.ExactMatch }
  | { kind: EvaluatorKind.NumericMatch; extractionPattern?: string; tolerance?: number }
  | { kind: EvaluatorKind.JsonSchemaMatch; jsonSchema?: string };

/* ── Providers ── */
export interface ProviderDto {
  id: string;
  name: string;
  endpoint: string;
  upstreamApiKey: string;
  kind: ModelProviderKind;
  createdAt: string;
  updatedAt: string;
}
/** A provider with its model endpoints and API keys embedded. */
export interface ProviderWithDetailsDto {
  provider: ProviderDto;
  models: ModelEndpointDto[];
  keys: ApiKeyDto[];
}
/** Single-call payload for the Providers page. */
export interface ProvidersOverviewDto {
  providers: ProviderWithDetailsDto[];
  projects: ProjectDto[];
}
export interface ModelEndpointDto {
  id: string;
  modelName: string;
  providerId: string;
  providerName: string;
  inputTokenCost: number | null;
  outputTokenCost: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface ApiKeyDto {
  id: string;
  name: string;
  keyValue: string;
  projectId: string;
  projectName: string;
  providerId: string;
  providerName: string;
  createdAt: string;
}
export interface ProjectMemberDto {
  id: string;
  email: string;
}
export interface ProjectDto {
  id: string;
  name: string;
  systemEndpointId: string;
  members: ProjectMemberDto[];
  createdAt: string;
  updatedAt: string;
}
export interface UserDto {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateModelEndpointRequest {
  modelName: string;
  inputTokenCost: number | null;
  outputTokenCost: number | null;
}
export interface UpdateModelEndpointPricingRequest {
  inputTokenCost: number | null;
  outputTokenCost: number | null;
}
export interface CreateProviderRequest {
  name: string;
  endpoint: string;
  upstreamApiKey: string;
  kind: ModelProviderKind;
}
export interface CreateApiKeyRequest { name: string; projectId: string; }

/* ── Fixture ── */
export interface TestCaseMessageFixtureDto {
  role: string;
  content: string;
  name?: string | null;
}
export interface ToolCallInfoDto { name: string; arguments: unknown; }
export interface OutputValueDto {
  kind: 'message' | 'tool_call';
  content?: string | null;
  tool?: ToolCallInfoDto | null;
  name?: string | null;
  arguments?: unknown;
}
export interface BreakdownItemDto { k: string; v: string; match: boolean; }
export interface EvaluatorFixtureResultDto {
  evaluatorId: string;
  evaluatorKind: string;
  evaluatorName: string;
  color: string;
  desc: string;
  score: number;
  pass: boolean;
  breakdown: BreakdownItemDto[];
  note: string;
}
export interface RuntimeBreakdownDto {
  total: number;
  ttft: number;
  gen: number;
  tools: number;
  judge?: number | null;
}
export interface EndpointUsageDto {
  id: string;
  label: string;
  color: string;
  region: string;
  pricingIn: number;
  pricingOut: number;
  tokIn: number;
  tokOut: number;
  calls: number;
  latency: number;
  costUsd: number;
}
export interface TestCaseFixtureDto {
  input: { messages: TestCaseMessageFixtureDto[] };
  expected: OutputValueDto;
  actual: OutputValueDto;
  evaluators: EvaluatorFixtureResultDto[];
  runtime: RuntimeBreakdownDto;
  endpoints: EndpointUsageDto[];
}

/* ── Filters ── */
export interface AgentCallFilter {
  projectId?: string;
  agentId?: string;
  model?: string;
  provider?: string;
  from?: string;
  to?: string;
  httpStatus?: number;
  includeSystemAgents?: boolean;
  q?: string;
  conversationId?: string;
  page?: number;
  pageSize?: number;
}

/* ── Optimization ── */
export enum ProposalKind { SystemPrompt = 'SystemPrompt', Tool = 'Tool', ModelSwitch = 'ModelSwitch' }
export enum ProposalStatus { Draft = 'Draft', Accepted = 'Accepted', Rejected = 'Rejected' }
export enum Priority { Low = 'Low', Medium = 'Medium', High = 'High', Critical = 'Critical' }

export interface ModelSwitchDetailsDto {
  kind: 'ModelSwitch';
  endpointId: string;
  currentModelName: string;
  proposedModelName: string;
  expectedCostDelta: number | null;
  expectedLatencyMs: number | null;
}

export interface SystemPromptDetailsDto {
  kind: 'SystemPrompt';
  currentSystemMessage: string;
  proposedSystemMessage: string;
}

export interface ToolDetailsDto {
  kind: 'Tool';
  currentTools: ToolSpecDto[];
  proposedTools: ToolSpecDto[];
}

export type ProposalDetailsDto = ModelSwitchDetailsDto | SystemPromptDetailsDto | ToolDetailsDto;

export interface AbTestRunSummaryDto {
  id: string;
  groupId: string;
  status: TestRunStatus;
  totalCases: number;
  completedCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export interface OptimizationProposalDto {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  agentId: string;
  agentName: string;
  priority: Priority;
  rationale: string;
  details: ProposalDetailsDto;
  evidenceTestRunIds: string[];
  abTestRun: AbTestRunSummaryDto | null;
  currentPassRate: number | null;
  proposedPassRate: number | null;
  expectedPassRateDelta: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalCreatedEvent {
  type: 'proposal-created';
  id: string;
  agentId: string;
  kind: ProposalKind;
  priority: Priority;
  rationale: string;
  createdAt: string;
}

export enum TheoryStatus { Proposed = 'Proposed', Validating = 'Validating', Validated = 'Validated', Invalidated = 'Invalidated' }
export enum TheorySource { Optimizer = 'Optimizer', User = 'User', TraceyAi = 'TraceyAi', External = 'External' }

export interface TheoryDto {
  id: string;
  kind: ProposalKind;
  status: TheoryStatus;
  source: TheorySource;
  agentId: string;
  agentName: string;
  suiteId: string;
  priority: Priority;
  rationale: string;
  details: ProposalDetailsDto;
  evidenceTestRunIds: string[];
  resultingProposalId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Seed-style proposed-change payloads accepted by POST /api/theories. */
export type SubmitTheoryDetails =
  | { kind: 'SystemPrompt'; currentSystemMessage: string; proposedSystemMessage: string }
  | { kind: 'ModelSwitchSeed'; proposedEndpointId: string }
  | { kind: 'ToolUpdateSeed'; proposedTools: { name: string; description: string; parametersJson: string | null }[] };

export interface SubmitTheoryRequest {
  agentId: string;
  suiteId: string;
  priority: Priority;
  rationale: string;
  source: TheorySource;
  details: SubmitTheoryDetails;
}

export interface TheoryStatusChangedEvent {
  type: 'theory-changed';
  id: string;
  agentId: string;
  kind: ProposalKind;
  status: TheoryStatus;
  source: TheorySource;
  priority: Priority;
  rationale: string;
  resultingProposalId: string | null;
  updatedAt: string;
}

/* ── SSE Events ── */
export interface TraceCreatedEvent {
  id: string;
  agentId: string;
  agentName: string;
  model: string;
  provider: string;
  createdAt: string;
}
export interface TestCaseStartedEvent { type: 'test-case-started'; runId: string; groupId: string; testCaseId: string; }
export interface InferenceDoneEvent { type: 'inference-done'; runId: string; groupId: string; testCaseId: string; }
export interface EvaluationArrivedEvent { type: 'evaluation-arrived'; runId: string; groupId: string; testCaseId: string; evaluation: EvaluationResultDto; }
export interface TestResultArrivedEvent { type: 'test-result-arrived'; runId: string; groupId: string; testCaseId: string; overallScore: EvaluationScore | null; evaluations: EvaluationResultDto[]; durationMs: number; }
export interface RunCompleteEvent { type: 'run-complete'; runId: string; groupId: string; status: TestRunStatus; completedAt: string | null; }
export interface GroupRunCompleteEvent { type: 'group-run-complete'; runId: string; groupId: string; groupStatus: TestRunStatus; groupCompletedAt: string | null; }
export type TestRunEvent =
  | TestCaseStartedEvent
  | InferenceDoneEvent
  | EvaluationArrivedEvent
  | TestResultArrivedEvent
  | RunCompleteEvent
  | GroupRunCompleteEvent;
