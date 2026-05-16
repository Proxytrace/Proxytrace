import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { AgentDto } from '../../../api/models';
import {
  EMPTY_PARAMETERS,
  EMPTY_SESSION,
  type PlaygroundMessage,
  type PlaygroundOverrides,
  type PlaygroundRole,
  type PlaygroundSession,
  type PlaygroundStats,
  type PlaygroundToolOverride,
  type PlaygroundToolRequest,
} from './types';

const STORAGE_KEY = 'trsr.playground.session.v1';

function loadFromStorage(): PlaygroundSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SESSION;
    const parsed = JSON.parse(raw) as PlaygroundSession;
    return {
      ...EMPTY_SESSION,
      ...parsed,
      isStreaming: false,
      pendingToolRequest: null,
      error: null,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

function saveToStorage(session: PlaygroundSession) {
  try {
    const { isStreaming: _isStreaming, pendingToolRequest: _pending, error: _error, ...rest } = session;
    void _isStreaming; void _pending; void _error;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    // ignore
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function makeMessage(role: PlaygroundRole, content = '', extras: Partial<PlaygroundMessage> = {}): PlaygroundMessage {
  return { localId: newId(), role, content, ...extras };
}

export function overridesFromAgent(agent: AgentDto): PlaygroundOverrides {
  return {
    endpointId: agent.endpointId,
    systemPrompt: agent.systemMessage ?? '',
    parameters: agent.modelParameters ?? EMPTY_PARAMETERS,
    tools: (agent.tools ?? []).map<PlaygroundToolOverride>(t => ({
      name: t.name,
      description: t.description,
      arguments: (t.arguments ?? []).map(a => ({
        name: a.name,
        description: a.description ?? '',
        type: a.type,
        isRequired: a.isRequired,
      })),
    })),
  };
}

type Action =
  | { type: 'reset' }
  | { type: 'clearAgent' }
  | { type: 'pickAgent'; agent: AgentDto }
  | { type: 'setOverrides'; overrides: PlaygroundOverrides }
  | { type: 'setMessages'; messages: PlaygroundMessage[] }
  | { type: 'addMessage'; message: PlaygroundMessage }
  | { type: 'updateMessage'; localId: string; patch: Partial<PlaygroundMessage> }
  | { type: 'deleteMessage'; localId: string }
  | { type: 'insertAt'; index: number; message: PlaygroundMessage }
  | { type: 'truncateAfter'; localId: string }
  | { type: 'startStreaming' }
  | { type: 'appendDelta'; localId: string; delta: string }
  | { type: 'finishStreaming'; stats: PlaygroundStats | null }
  | { type: 'setError'; message: string }
  | { type: 'setPendingTool'; request: PlaygroundToolRequest | null }
  | { type: 'attachToolRequests'; localId: string; toolRequests: PlaygroundToolRequest[] }
  | { type: 'reorderMessages'; messages: PlaygroundMessage[] };

function reducer(state: PlaygroundSession, action: Action): PlaygroundSession {
  switch (action.type) {
    case 'reset':
      return { ...EMPTY_SESSION, agentId: state.agentId, overrides: state.overrides };
    case 'clearAgent':
      return EMPTY_SESSION;
    case 'pickAgent':
      return {
        ...EMPTY_SESSION,
        agentId: action.agent.id,
        overrides: overridesFromAgent(action.agent),
      };
    case 'setOverrides':
      return { ...state, overrides: action.overrides };
    case 'setMessages':
      return { ...state, messages: action.messages, lastStats: null, pendingToolRequest: null, error: null };
    case 'addMessage':
      return { ...state, messages: [...state.messages, action.message] };
    case 'updateMessage':
      return {
        ...state,
        messages: state.messages.map(m => (m.localId === action.localId ? { ...m, ...action.patch } : m)),
      };
    case 'deleteMessage':
      return { ...state, messages: state.messages.filter(m => m.localId !== action.localId) };
    case 'insertAt': {
      const next = state.messages.slice();
      next.splice(action.index, 0, action.message);
      return { ...state, messages: next };
    }
    case 'truncateAfter': {
      const idx = state.messages.findIndex(m => m.localId === action.localId);
      if (idx < 0) return state;
      return { ...state, messages: state.messages.slice(0, idx + 1) };
    }
    case 'startStreaming':
      return { ...state, isStreaming: true, error: null, lastStats: null };
    case 'appendDelta':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.localId === action.localId ? { ...m, content: m.content + action.delta } : m,
        ),
      };
    case 'finishStreaming':
      return { ...state, isStreaming: false, lastStats: action.stats };
    case 'setError':
      return { ...state, isStreaming: false, error: action.message };
    case 'setPendingTool':
      return { ...state, pendingToolRequest: action.request };
    case 'reorderMessages':
      return { ...state, messages: action.messages };
    case 'attachToolRequests':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.localId === action.localId ? { ...m, toolRequests: action.toolRequests } : m,
        ),
      };
    default:
      return state;
  }
}

export function usePlaygroundSession() {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as PlaygroundSession, loadFromStorage);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const getState = useCallback(() => stateRef.current, []);

  return { state, dispatch, getState };
}
