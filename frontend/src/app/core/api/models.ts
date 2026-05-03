export enum TestRunStatus { Pending = 'Pending', Running = 'Running', Completed = 'Completed', Failed = 'Failed' }
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

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

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

export interface TestSuiteMessageDto {
  role: string;
  content: string;
}

export interface TestCaseDto {
  id: string;
  input: TestSuiteMessageDto[];
  expectedOutput: TestSuiteMessageDto;
}

export interface SuiteEvaluatorDto {
  id: string;
  kind: EvaluatorKind;
}

export interface TestSuiteDto {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  evaluators: SuiteEvaluatorDto[];
  testCases: TestCaseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TestResultDto {
  id: string;
  testCaseId: string;
  testCaseSummary: string;
  actualResponse: string;
  evaluations: string[];
  durationMs: number;
}

export interface TestCaseRowDto {
  id: string;
  summary: string;
}

export interface TestRunDto {
  id: string;
  suiteId: string | null;
  suiteName: string | null;
  agentId: string;
  agentName: string;
  status: TestRunStatus;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  testCases: TestCaseRowDto[];
  results: TestResultDto[];
  createdAt: string;
  updatedAt: string;
}

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

export interface TraceCreatedEvent {
  id: string;
  agentId: string;
  agentName: string;
  model: string;
  provider: string;
  createdAt: string;
}

export interface TestResultArrivedEvent {
  type: 'test-result-arrived';
  runId: string;
  testCaseId: string;
  overallScore: string | null;
  evaluations: string[];
  durationMs: number;
}

export interface RunCompleteEvent {
  type: 'run-complete';
  runId: string;
  status: TestRunStatus;
  completedAt: string | null;
}

export type TestRunEvent = TestResultArrivedEvent | RunCompleteEvent;
