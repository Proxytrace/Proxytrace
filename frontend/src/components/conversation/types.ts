/**
 * Normalized, read-only conversation model shared by every conversation view in the
 * app (trace details, test cases, search previews, run fixtures). Adapters in
 * `adapters.ts` convert the various API DTO shapes into this single model so the
 * rendering logic lives in exactly one place — `ConversationView`.
 */

import type { MessageDescriptor } from '@lingui/core';

export type ConversationRole = 'user' | 'assistant' | 'system' | 'tool';

/** An assistant-issued tool invocation. `arguments` is a raw JSON string (the bubble parses it). */
export interface ConversationToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  /** Tool calls issued by this (assistant) message. */
  toolCalls?: ConversationToolCall[];
  /** Set on a tool-result message; links it back to the originating tool call. */
  toolCallId?: string | null;
  /**
   * Optional header label override in place of the role name. A plain string is shown
   * verbatim (e.g. a dynamic role qualifier); a `MessageDescriptor` is localized at render.
   */
  label?: string | MessageDescriptor;
}
