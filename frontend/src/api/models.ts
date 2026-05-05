export enum TestRunStatus {
  Pending = 'Pending',
  Running = 'Running',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
}

export enum Evaluation { Pass = 'Pass', Fail = 'Fail', Undecided = 'Undecided' }

export enum EvaluatorKind {
  Custom = 'Custom',
  ExactMatch = 'ExactMatch',
  NumericMatch = 'NumericMatch',
  Helpfulness = 'Helpfulness',
  Politeness = 'Politeness',
  JsonSchemaMatch = 'JsonSchemaMatch',
  Safety = 'Safety',
  ToolUsage = 'ToolUsage',
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
export interface AgentCallDto {
  id: string;
  agentId: string | null;
  agentName: string | null;
  model: string;
  provider: string;
  request: MessageDto[];
  response: MessageDto;
  tools: ToolSpecDto[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  httpStatus: number;
  finishReason: string | null;
  errorMessage: string | null;
  costEur: number | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Agents ── */
export interface AgentDto {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  systemMessage: string;
  tools: ToolSpecDto[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

/* ── Statistics ── */
export interface SummaryDto {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgLatencyMs: number;
  overallPassRate: number;
}
export interface ModelBreakdownDto {
  endpointId: string;
  modelName: string;
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgDurationMs: number;
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

/* ── Test Suites ── */
export interface TestSuiteMessageDto { role: string; content: string; }
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
export interface EvaluationResultDto {
  evaluatorId: string;
  evaluatorKind: EvaluatorKind;
  evaluatorName: string;
  score: string;
  reasoning: string | null;
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
  endpointId: string | null;
  endpointName: string | null;
  jsonSchema: string | null;
  extractionPattern: string | null;
  tolerance: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateEvaluatorPayload {
  kind: EvaluatorKind;
  name?: string | null;
  systemMessage?: string | null;
  endpointId?: string | null;
  jsonSchema?: string | null;
  extractionPattern?: string | null;
  tolerance?: number | null;
}

/* ── Providers ── */
export interface ProviderDto {
  id: string;
  name: string;
  endpoint: string;
  upstreamApiKey: string;
  kind: ModelProviderKind;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
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
export interface ProjectDto {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
}
export interface OrganizationDto { id: string; name: string; }
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
  organizationId: string;
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
  page?: number;
  pageSize?: number;
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
export interface TestResultArrivedEvent { type: 'test-result-arrived'; runId: string; groupId: string; testCaseId: string; overallScore: string | null; evaluations: EvaluationResultDto[]; durationMs: number; }
export interface RunCompleteEvent { type: 'run-complete'; runId: string; groupId: string; status: TestRunStatus; completedAt: string | null; }
export interface GroupRunCompleteEvent { type: 'group-run-complete'; runId: string; groupId: string; groupStatus: TestRunStatus; groupCompletedAt: string | null; }
export type TestRunEvent =
  | TestCaseStartedEvent
  | InferenceDoneEvent
  | EvaluationArrivedEvent
  | TestResultArrivedEvent
  | RunCompleteEvent
  | GroupRunCompleteEvent;
