import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import useCurrentProject from '../../hooks/useCurrentProject';
import { agentsApi } from '../../api/agents';
import { agentCallsApi } from '../../api/agent-calls';
import {
  streamPlaygroundCompletion,
  type PlaygroundCompletePayload,
  type PlaygroundMessagePayload,
  type PlaygroundStreamEvent,
} from '../../api/playground';
import type { AgentCallDto, MessageDto } from '../../api/models';
import { AgentPicker } from './components/AgentPicker';
import { RightRail } from './components/RightRail';
import { ConversationView } from './components/ConversationView';
import { ComposeBox } from './components/ComposeBox';
import { ToolRequestPrompt } from './components/ToolRequestPrompt';
import { CompletionStats } from './components/CompletionStats';
import { PlayIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { UnifiedSearch } from '../../components/search/UnifiedSearch';
import { loadMessagesForHit } from './lib/seed';
import { makeMessage, overridesFromAgent, usePlaygroundSession } from './state/usePlaygroundSession';
import type { PlaygroundMessage, PlaygroundRole, PlaygroundToolRequest } from './state/types';

export default function Playground() {
  const { currentProject } = useCurrentProject();
  const { state, dispatch } = usePlaygroundSession();
  const [showSeed, setShowSeed] = useState(false);
  const seedAnchorRef = useRef<HTMLDivElement | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: agent, error: agentError } = useQuery({
    queryKey: ['agent', state.agentId],
    queryFn: async () => {
      try {
        return await agentsApi.get(state.agentId!);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('404')) return null;
        throw e;
      }
    },
    enabled: !!state.agentId,
    throwOnError: false,
  });

  useEffect(() => {
    if (state.agentId && (agent === null || agentError)) {
      dispatch({ type: 'clearAgent' });
    }
  }, [state.agentId, agent, agentError, dispatch]);

  const { data: agentsList } = useQuery({
    queryKey: ['agents', currentProject?.id],
    queryFn: () => agentsApi.list({ projectId: currentProject!.id, pageSize: 200 }),
    enabled: !!currentProject,
  });

  useEffect(() => {
    if (state.agentId) return;
    const first = agentsList?.items?.[0];
    if (first) dispatch({ type: 'pickAgent', agent: first });
  }, [state.agentId, agentsList, dispatch]);

  const autoLoadedAgentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state.agentId || !agent) return;
    if (autoLoadedAgentRef.current === state.agentId) return;
    if (state.messages.length > 0) {
      autoLoadedAgentRef.current = state.agentId;
      return;
    }
    let cancelled = false;
    autoLoadedAgentRef.current = state.agentId;
    agentCallsApi.list({ agentId: state.agentId, pageSize: 1, includeSystemAgents: true })
      .then(res => {
        if (cancelled) return;
        const call = res.items[0];
        if (!call) return;
        dispatch({ type: 'setMessages', messages: agentCallToMessages(call) });
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [state.agentId, agent, state.messages.length, dispatch]);

  const requestedAgentId = searchParams.get('agentId');
  useEffect(() => {
    if (!requestedAgentId) return;
    if (state.agentId === requestedAgentId) {
      setSearchParams({}, { replace: true });
      return;
    }
    let cancelled = false;
    agentsApi.get(requestedAgentId).then(a => {
      if (cancelled) return;
      dispatch({ type: 'pickAgent', agent: a });
      setSearchParams({}, { replace: true });
    }).catch(() => {
      if (!cancelled) setSearchParams({}, { replace: true });
    });
    return () => { cancelled = true; };
  }, [requestedAgentId, state.agentId, dispatch, setSearchParams]);

  const buildPayload = useCallback((messages: PlaygroundMessage[]): PlaygroundCompletePayload | null => {
    if (!state.agentId || !state.overrides) return null;
    return {
      agentId: state.agentId,
      endpointId: state.overrides.endpointId,
      systemPrompt: state.overrides.systemPrompt,
      parameters: state.overrides.parameters,
      tools: state.overrides.tools.map(t => ({
        name: t.name,
        description: t.description,
        arguments: t.arguments.map(a => ({
          name: a.name,
          description: a.description || null,
          type: a.type,
          isRequired: a.isRequired,
        })),
      })),
      messages: messages.map(toPayloadMessage),
    };
  }, [state.agentId, state.overrides]);

  const startStream = useCallback((messagesForBackend: PlaygroundMessage[], placeholderId: string) => {
    const payload = buildPayload(messagesForBackend);
    if (!payload) return;
    setStreamingId(placeholderId);
    dispatch({ type: 'startStreaming' });
    let collectedTools: PlaygroundToolRequest[] = [];
    let firstPending: PlaygroundToolRequest | null = null;

    abortRef.current?.abort();
    abortRef.current = streamPlaygroundCompletion(payload, (e: PlaygroundStreamEvent) => {
      if (e.type === 'token') {
        dispatch({ type: 'appendDelta', localId: placeholderId, delta: e.delta });
      } else if (e.type === 'tool-request') {
        const req: PlaygroundToolRequest = { id: e.id, name: e.name, arguments: e.arguments };
        collectedTools = [...collectedTools, req];
        dispatch({ type: 'attachToolRequests', localId: placeholderId, toolRequests: collectedTools });
        if (!firstPending) firstPending = req;
      } else if (e.type === 'done') {
        dispatch({
          type: 'finishStreaming',
          stats: {
            inputTokens: e.inputTokens,
            outputTokens: e.outputTokens,
            latencyMs: e.latencyMs,
            costEur: e.costEur,
            finishReason: e.finishReason,
          },
        });
        setStreamingId(null);
        if (firstPending) dispatch({ type: 'setPendingTool', request: firstPending });
      } else if (e.type === 'error') {
        dispatch({ type: 'updateMessage', localId: placeholderId, patch: { errored: true } });
        dispatch({ type: 'setError', message: e.message });
        setStreamingId(null);
      }
    });
  }, [buildPayload, dispatch]);

  const sendUserMessage = useCallback((text: string) => {
    const userMsg = makeMessage('user', text);
    const placeholder = makeMessage('assistant', '');
    const next = [...state.messages, userMsg, placeholder];
    dispatch({ type: 'setMessages', messages: next });
    startStream(next.slice(0, -1), placeholder.localId);
  }, [state.messages, dispatch, startStream]);

  const onToolResult = useCallback((result: { content: string; success: boolean; error?: string }) => {
    const pending = state.pendingToolRequest;
    if (!pending) return;
    const toolMsg = makeMessage('tool', result.content, {
      toolCallId: pending.id,
      toolSucceeded: result.success,
      toolError: result.error,
    });
    const next = [...state.messages, toolMsg];

    // Find next unresolved tool_call from the most recent assistant message with tool_calls.
    let nextPending: PlaygroundToolRequest | null = null;
    for (let i = next.length - 1; i >= 0; i--) {
      const m = next[i];
      if (m.role === 'assistant' && m.toolRequests && m.toolRequests.length > 0) {
        const respondedIds = new Set(
          next.slice(i + 1).filter(x => x.role === 'tool' && x.toolCallId).map(x => x.toolCallId!),
        );
        nextPending = m.toolRequests.find(tr => !respondedIds.has(tr.id)) ?? null;
        break;
      }
      if (m.role === 'user') break;
    }

    if (nextPending) {
      dispatch({ type: 'setMessages', messages: next });
      dispatch({ type: 'setPendingTool', request: nextPending });
      return;
    }

    const placeholder = makeMessage('assistant', '');
    const withPlaceholder = [...next, placeholder];
    dispatch({ type: 'setPendingTool', request: null });
    dispatch({ type: 'setMessages', messages: withPlaceholder });
    startStream(next, placeholder.localId);
  }, [state.pendingToolRequest, state.messages, dispatch, startStream]);

  const onRunCompletion = useCallback(() => {
    const placeholder = makeMessage('assistant', '');
    const next = [...state.messages, placeholder];
    dispatch({ type: 'setMessages', messages: next });
    startStream(state.messages, placeholder.localId);
  }, [state.messages, dispatch, startStream]);

  const canRunCompletion =
    !!state.agentId &&
    !state.isStreaming &&
    !state.pendingToolRequest &&
    state.messages.length > 0;

  const onInsert = useCallback((atIndex: number, role: PlaygroundRole) => {
    dispatch({ type: 'insertAt', index: atIndex, message: makeMessage(role, '') });
  }, [dispatch]);

  const onMove = useCallback((fromId: string, toIndex: number) => {
    const from = state.messages.findIndex(m => m.localId === fromId);
    if (from < 0) return;
    if (toIndex === from || toIndex === from + 1) return;
    const next = state.messages.slice();
    const [moved] = next.splice(from, 1);
    const insertAt = toIndex > from ? toIndex - 1 : toIndex;
    next.splice(insertAt, 0, moved);
    dispatch({ type: 'reorderMessages', messages: next });
  }, [state.messages, dispatch]);

  const onClearConversation = useCallback(() => {
    abortRef.current?.abort();
    setStreamingId(null);
    if (state.agentId) autoLoadedAgentRef.current = state.agentId;
    dispatch({ type: 'reset' });
  }, [dispatch, state.agentId]);

  const onLoadFromSearch = useCallback((messages: PlaygroundMessage[]) => {
    dispatch({ type: 'setMessages', messages });
  }, [dispatch]);

  useEffect(() => {
    if (!showSeed) return;
    function onDocClick(e: MouseEvent) {
      if (!seedAnchorRef.current) return;
      if (!seedAnchorRef.current.contains(e.target as Node)) setShowSeed(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowSeed(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showSeed]);

  const defaultEndpointId = agent?.endpointId;

  const composerDisabledReason = !state.agentId
    ? 'Pick an agent on the left to start a conversation.'
    : state.isStreaming
    ? 'Waiting for the model to finish streaming…'
    : null;

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-[13px]">
        Pick a project first.
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-[12px] overflow-hidden p-[2px]">
      {/* Center conversation */}
      <section
        className="flex-1 rounded-[14px] flex flex-col overflow-hidden min-w-0"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <header
          className="flex items-center gap-[8px] px-[12px] py-[10px] flex-wrap"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <AgentPicker
            projectId={currentProject.id}
            selectedAgentId={state.agentId}
            selectedAgent={agent ?? null}
            onPick={a => dispatch({ type: 'pickAgent', agent: a })}
            compact
          />
          <button
            type="button"
            className="btn-icon"
            onClick={onClearConversation}
            disabled={!state.agentId || state.messages.length === 0}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <TrashIcon size={13} strokeWidth={2.2} />
          </button>
          <div ref={seedAnchorRef} className="relative">
            <button
              type="button"
              className="btn-icon"
              onClick={() => setShowSeed(o => !o)}
              disabled={!state.agentId}
              title="Load from trace or test case"
              aria-label="Load from trace or test case"
              aria-expanded={showSeed}
              aria-haspopup="listbox"
            >
              <SearchIcon size={13} strokeWidth={2.2} />
            </button>
            {showSeed && (
              <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-[480px] max-w-[80vw]">
                <UnifiedSearch
                  projectId={currentProject.id}
                  kinds={['agentCall', 'testCase']}
                  width="auto"
                  autoFocus
                  showShortcut={false}
                  placeholder="Search traces and test cases…"
                  onSelect={async hit => {
                    try {
                      const messages = await loadMessagesForHit(hit);
                      onLoadFromSearch(messages);
                    } finally {
                      setShowSeed(false);
                    }
                  }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onRunCompletion}
            disabled={!canRunCompletion}
            data-write
            title="Run completion on current conversation"
            aria-label="Run completion on current conversation"
          >
            <PlayIcon size={13} strokeWidth={2.4} />
          </button>
          <div className="ml-auto">
            <CompletionStats stats={state.lastStats} streaming={state.isStreaming} />
          </div>
        </header>

        {state.error && (
          <div
            className="px-[14px] py-[6px] text-[11.5px] mono"
            style={{
              background: 'var(--danger-subtle)',
              borderBottom: '1px solid color-mix(in srgb, var(--danger) 32%, transparent)',
              color: 'var(--danger)',
            }}
          >
            {state.error}
          </div>
        )}

        <ConversationView
          messages={state.messages}
          systemPrompt={state.overrides?.systemPrompt}
          agentName={agent?.name}
          tools={state.overrides?.tools}
          isStreaming={state.isStreaming}
          streamingId={streamingId}
          onEdit={(localId, content) => dispatch({ type: 'updateMessage', localId, patch: { content } })}
          onDelete={localId => dispatch({ type: 'deleteMessage', localId })}
          onInsert={onInsert}
          onMove={onMove}
          onLoadFromTrace={state.agentId ? () => setShowSeed(true) : undefined}
        />

        {state.pendingToolRequest ? (
          <div className="p-[12px]" style={{ borderTop: '1px solid var(--border-color)' }}>
            <ToolRequestPrompt
              request={state.pendingToolRequest}
              onSubmit={onToolResult}
              onCancel={() => dispatch({ type: 'setPendingTool', request: null })}
            />
          </div>
        ) : (
          <ComposeBox
            disabled={!state.agentId || state.isStreaming}
            disabledReason={composerDisabledReason}
            endpointId={state.overrides?.endpointId ?? null}
            defaultEndpointId={defaultEndpointId ?? null}
            onEndpointChange={state.overrides ? (endpointId) => dispatch({
              type: 'setOverrides',
              overrides: { ...state.overrides!, endpointId },
            }) : undefined}
            onSend={sendUserMessage}
          />
        )}
      </section>

      {/* Right icon-drawer */}
      {state.overrides && (
        <RightRail
          overrides={state.overrides}
          defaultSystemPrompt={agent?.systemMessage}
          defaultParameters={agent?.modelParameters ?? null}
          hasAgentDefaults={!!agent}
          onChange={overrides => dispatch({ type: 'setOverrides', overrides })}
          onResetAll={() => agent && dispatch({ type: 'setOverrides', overrides: overridesFromAgent(agent) })}
        />
      )}

    </div>
  );
}

function roleFromString(role: string): PlaygroundRole {
  const lower = role.toLowerCase();
  if (lower === 'user' || lower === 'assistant' || lower === 'system' || lower === 'tool') return lower;
  return 'user';
}

function agentCallToMessages(call: AgentCallDto): PlaygroundMessage[] {
  const toMsg = (m: MessageDto): PlaygroundMessage => {
    const base = makeMessage(roleFromString(m.role), m.content ?? '');
    if (m.toolRequests && m.toolRequests.length > 0) {
      base.toolRequests = m.toolRequests.map(tr => ({ id: tr.id, name: tr.name, arguments: tr.arguments }));
    }
    if (m.toolCallId) base.toolCallId = m.toolCallId;
    return base;
  };
  const out: PlaygroundMessage[] = call.request.map(toMsg);
  if (call.response) out.push(toMsg(call.response));
  return out;
}

function toPayloadMessage(m: PlaygroundMessage): PlaygroundMessagePayload {
  return {
    role: m.role,
    content: m.content,
    toolRequests: (m.toolRequests ?? []).map(tr => ({ id: tr.id, name: tr.name, arguments: tr.arguments })),
    toolCallId: m.toolCallId ?? null,
    toolSucceeded: m.toolSucceeded ?? true,
    toolError: m.toolError ?? null,
  };
}
