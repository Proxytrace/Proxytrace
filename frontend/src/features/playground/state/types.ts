import type { ModelParametersDto } from '../../../api/models';

export type PlaygroundRole = 'system' | 'user' | 'assistant' | 'tool';

export interface PlaygroundToolRequest {
  id: string;
  name: string;
  arguments: string;
}

export interface PlaygroundMessage {
  localId: string;
  role: PlaygroundRole;
  content: string;
  toolRequests?: PlaygroundToolRequest[];
  toolCallId?: string;
  toolSucceeded?: boolean;
  toolError?: string;
  errored?: boolean;
}

export interface PlaygroundToolArgumentOverride {
  name: string;
  description: string;
  type: string;
  isRequired: boolean;
}

export interface PlaygroundToolOverride {
  /** Stable client-side identity for list keys — names are editable and can collide. */
  localId: string;
  name: string;
  description: string;
  arguments: PlaygroundToolArgumentOverride[];
}

export interface PlaygroundOverrides {
  endpointId: string;
  systemPrompt: string;
  parameters: ModelParametersDto;
  tools: PlaygroundToolOverride[];
}

export interface PlaygroundStats {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costEur: number | null;
  finishReason: string | null;
}

export interface PlaygroundSession {
  agentId: string | null;
  overrides: PlaygroundOverrides | null;
  messages: PlaygroundMessage[];
  lastStats: PlaygroundStats | null;
  isStreaming: boolean;
  pendingToolRequest: PlaygroundToolRequest | null;
  error: string | null;
}

export const EMPTY_PARAMETERS: ModelParametersDto = {
  temperature: null,
  topP: null,
  reasoningEffort: null,
  frequencyPenalty: null,
  presencePenalty: null,
  maxTokens: null,
  seed: null,
  stop: null,
  n: null,
};

export const EMPTY_SESSION: PlaygroundSession = {
  agentId: null,
  overrides: null,
  messages: [],
  lastStats: null,
  isStreaming: false,
  pendingToolRequest: null,
  error: null,
};
