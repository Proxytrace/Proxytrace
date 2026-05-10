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
import { OverridesPanel } from './components/OverridesPanel';
import { ConversationView } from './components/ConversationView';
import { ComposeBox } from './components/ComposeBox';
import { ToolRequestPrompt } from './components/ToolRequestPrompt';
import { SeedFromSearchModal } from './components/SeedFromSearchModal';
import { CompletionStats } from './components/CompletionStats';
import { makeMessage, overridesFromAgent, usePlaygroundSession } from './state/usePlaygroundSession';
import type { PlaygroundMessage, PlaygroundRole, PlaygroundToolRequest } from './state/types';

export default function Playground() {
  const { currentProject } = useCurrentProject();
  const { state, dispatch } = usePlaygroundSession();
  const [showSeedModal, setShowSeedModal] = useState(false);
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
        if (firstPending) dispatch({ type: 'setPendingTool', request: firstPending });
      } else if (e.type === 'error') {
        dispatch({ type: 'updateMessage', localId: placeholderId, patch: { errored: true } });
        dispatch({ type: 'setError', message: e.message });
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

  const onResetSession = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'reset' });
  }, [dispatch]);

  const onLoadFromSearch = useCallback((messages: PlaygroundMessage[]) => {
    dispatch({ type: 'setMessages', messages });
  }, [dispatch]);

  const defaultEndpointId = agent?.endpointId;

  if (!currentProject) {
    return <div className="flex-1 flex items-center justify-center text-muted text-[13px]">Pick a project first.</div>;
  }

  return (
    <div className="flex-1 flex gap-[10px] overflow-hidden">
      {/* Left rail */}
      <div className="w-[260px] shrink-0 bg-card-2 rounded-[12px] border border-border p-[14px] flex flex-col gap-[12px] overflow-y-auto">
        <AgentPicker
          projectId={currentProject.id}
          selectedAgentId={state.agentId}
          onPick={a => dispatch({ type: 'pickAgent', agent: a })}
        />
        <button
          className="btn-ghost w-full"
          onClick={() => setShowSeedModal(true)}
          disabled={!state.agentId}
        >
          Load from search…
        </button>
        <button className="btn-ghost w-full" onClick={onResetSession}>
          New session
        </button>
        {agent && state.overrides && (
          <button
            className="btn-ghost w-full text-[11px]"
            onClick={() => dispatch({ type: 'setOverrides', overrides: overridesFromAgent(agent) })}
          >
            Reset overrides to agent defaults
          </button>
        )}
        {state.error && (
          <div className="text-[11px] text-danger break-words">{state.error}</div>
        )}
      </div>

      {/* Center conversation */}
      <div className="flex-1 bg-card-2 rounded-[12px] border border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-[14px] py-[10px] border-b border-border">
          <div className="text-[12.5px] font-semibold">
            {agent ? agent.name : 'No agent selected'}
          </div>
          <CompletionStats stats={state.lastStats} streaming={state.isStreaming} />
        </div>

        <ConversationView
          messages={state.messages}
          onEdit={(localId, content) => dispatch({ type: 'updateMessage', localId, patch: { content } })}
          onDelete={localId => dispatch({ type: 'deleteMessage', localId })}
          onInsert={onInsert}
          onReroll={onReroll}
        />

        {state.pendingToolRequest ? (
          <div className="p-[12px] border-t border-border">
            <ToolRequestPrompt
              request={state.pendingToolRequest}
              onSubmit={onToolResult}
              onCancel={() => dispatch({ type: 'setPendingTool', request: null })}
            />
          </div>
        ) : (
          <ComposeBox
            disabled={!state.agentId || state.isStreaming}
            onSend={sendUserMessage}
          />
        )}
      </div>

      {/* Right rail */}
      <div className="w-[340px] shrink-0 bg-card-2 rounded-[12px] border border-border flex flex-col overflow-hidden">
        {state.overrides ? (
          <OverridesPanel
            overrides={state.overrides}
            defaultEndpointId={defaultEndpointId}
            onChange={overrides => dispatch({ type: 'setOverrides', overrides })}
          />
        ) : (
          <div className="p-[14px] text-[12px] text-muted italic">Pick an agent to configure overrides.</div>
        )}
      </div>

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
