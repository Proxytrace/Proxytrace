import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentProject } from '../../contexts/ProjectContext';
import { agentsApi } from '../../api/agents';
import {
  streamPlaygroundCompletion,
  type PlaygroundCompletePayload,
  type PlaygroundMessagePayload,
  type PlaygroundStreamEvent,
} from '../../api/playground';
import { AgentPicker } from './components/AgentPicker';
import { RightRail } from './components/RightRail';
import { ConversationView } from './components/ConversationView';
import { ComposeBox } from './components/ComposeBox';
import { ToolRequestPrompt } from './components/ToolRequestPrompt';
import { SeedFromSearchModal } from './components/SeedFromSearchModal';
import { CompletionStats } from './components/CompletionStats';
import { ArrowDownToLineIcon, PlusIcon } from '../../components/icons';
import { makeMessage, overridesFromAgent, usePlaygroundSession } from './state/usePlaygroundSession';
import type { PlaygroundMessage, PlaygroundRole, PlaygroundToolRequest } from './state/types';

export default function Playground() {
  const { currentProject } = useCurrentProject();
  const { state, dispatch } = usePlaygroundSession();
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);

  const { data: agent } = useQuery({
    queryKey: ['agent', state.agentId],
    queryFn: () => agentsApi.get(state.agentId!),
    enabled: !!state.agentId,
  });

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

  const onReroll = useCallback((localId: string) => {
    const idx = state.messages.findIndex(m => m.localId === localId);
    if (idx < 0) return;
    const truncated = state.messages.slice(0, idx + 1);
    const placeholder = makeMessage('assistant', '');
    const next = [...truncated, placeholder];
    dispatch({ type: 'setMessages', messages: next });
    startStream(truncated, placeholder.localId);
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
    const placeholder = makeMessage('assistant', '');
    const withPlaceholder = [...next, placeholder];
    dispatch({ type: 'setPendingTool', request: null });
    dispatch({ type: 'setMessages', messages: withPlaceholder });
    startStream(next, placeholder.localId);
  }, [state.pendingToolRequest, state.messages, dispatch, startStream]);

  const onInsert = useCallback((atIndex: number, role: PlaygroundRole) => {
    dispatch({ type: 'insertAt', index: atIndex, message: makeMessage(role, '') });
  }, [dispatch]);

  const onNewSession = useCallback(() => {
    abortRef.current?.abort();
    setStreamingId(null);
    dispatch({ type: 'reset' });
  }, [dispatch]);

  const onLoadFromSearch = useCallback((messages: PlaygroundMessage[]) => {
    dispatch({ type: 'setMessages', messages });
  }, [dispatch]);

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
          background: 'var(--bg-card-2)',
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
            onClick={onNewSession}
            disabled={!state.agentId}
            title="New session"
            aria-label="New session"
          >
            <PlusIcon size={13} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setShowSeedModal(true)}
            disabled={!state.agentId}
            title="Load from trace"
            aria-label="Load from trace"
          >
            <ArrowDownToLineIcon size={13} strokeWidth={2.2} />
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
              borderBottom: '1px solid rgba(217,85,85,0.28)',
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
          onReroll={onReroll}
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

      {showSeedModal && (
        <SeedFromSearchModal
          projectId={currentProject.id}
          onClose={() => setShowSeedModal(false)}
          onLoad={onLoadFromSearch}
        />
      )}
    </div>
  );
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
