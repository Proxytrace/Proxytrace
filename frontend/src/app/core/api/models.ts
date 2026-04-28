export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MessageDto {
  role: string;
  content: string;
}

export interface AgentCallDto {
  id: string;
  agentId: string | null;
  model: string;
  provider: string;
  request: MessageDto[];
  response: MessageDto;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  httpStatus: number;
  finishReason: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDto {
  id: string;
  projectId: string;
  projectName: string;
  systemMessage: string;
  tools: { name: string; description: string }[];
  createdAt: string;
  updatedAt: string;
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
