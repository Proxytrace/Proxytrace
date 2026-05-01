export enum TestRunStatus { Pending = 0, Running = 1, Completed = 2, Failed = 3 }
export enum Evaluation { Pass = 0, Fail = 1, Undecided = 2 }

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

export interface TestSuiteDto {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  evaluatorKind: number;
  testCases: TestCaseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TestResultDto {
  id: string;
  testCaseId: string;
  testCaseSummary: string;
  actualResponse: string;
  evaluation: number; // 0=Pass, 1=Fail, 2=Undecided
  durationMs: number;
}

export interface TestRunDto {
  id: string;
  suiteId: string | null;
  suiteName: string | null;
  agentId: string;
  agentName: string;
  status: number; // 0=Pending, 1=Running, 2=Completed, 3=Failed
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
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
