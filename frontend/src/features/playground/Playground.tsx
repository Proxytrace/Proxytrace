import { useCallback, useState } from 'react';
import useCurrentProject from '../../hooks/useCurrentProject';
import { PlayIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { UnifiedSearch } from '../../components/search/UnifiedSearch';
import { loadMessagesForHit } from './lib/seed';
import { makeMessage, overridesFromAgent, usePlaygroundSession } from './state/usePlaygroundSession';
import type { PlaygroundMessage, PlaygroundRole, PlaygroundToolRequest } from './state/types';
import {
  usePlaygroundAgent,
  usePlaygroundAgentList,
  useAutoLoadAgentCall,
  useAgentFromSearchParam,
} from './hooks/usePlaygroundAgent';
import { usePlaygroundStream } from './hooks/usePlaygroundStream';
import { useSeedDropdown } from './hooks/useSeedDropdown';
import { AgentPicker } from './components/AgentPicker';
import { RightRail } from './components/RightRail';
import { ConversationView } from './components/ConversationView';
import { ComposeBox } from './components/ComposeBox';
import { ToolRequestPrompt } from './components/ToolRequestPrompt';
import { CompletionStats } from './components/CompletionStats';

export default function Playground() {
  const { currentProject } = useCurrentProject();
  const { state, dispatch } = usePlaygroundSession();
  const { showSeed, setShowSeed, seedAnchorRef } = useSeedDropdown();
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const { agent } = usePlaygroundAgent({ agentId: state.agentId, dispatch });
  usePlaygroundAgentList({ projectId: currentProject?.id, agentId: state.agentId, dispatch });
  useAutoLoadAgentCall({ agentId: state.agentId, agent, messages: state.messages, dispatch });
  useAgentFromSearchParam({ agentId: state.agentId, dispatch });

  const { startStream, abortStream } = usePlaygroundStream({
    agentId: state.agentId,
    overrides: state.overrides,
    dispatch,
    setStreamingId,
  });

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

    let nextPending: PlaygroundToolRequest | null = null;
    for (let i = next.length - 1; i >= 0; i--) {
      const m = next[i];
      if (m.role === 'assistant' && m.toolRequests && m.toolRequests.length > 0) {
        const respondedIds = new Set(
          next.slice(i + 1)
            .filter(x => x.role === 'tool')
            .map(x => x.toolCallId)
            .filter((id): id is string => id != null),
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
    abortStream();
    setStreamingId(null);
    dispatch({ type: 'reset' });
  }, [dispatch, abortStream]);

  const onLoadFromSearch = useCallback((messages: PlaygroundMessage[]) => {
    dispatch({ type: 'setMessages', messages });
  }, [dispatch]);

  const canRunCompletion =
    !!state.agentId &&
    !state.isStreaming &&
    !state.pendingToolRequest &&
    state.messages.length > 0;

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
      <section className="flex-1 rounded-lg flex flex-col overflow-hidden min-w-0 bg-card border border-border shadow-[var(--shadow-card)]">
        <header className="flex items-center gap-[8px] px-[12px] py-[10px] flex-wrap border-b border-border">
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
          <div className="px-[14px] py-[6px] text-[11.5px] mono bg-danger-subtle border-b border-[color-mix(in_srgb,var(--danger)_32%,transparent)] text-danger">
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
            disabledReason={composerDisabledReason}
            endpointId={state.overrides?.endpointId ?? null}
            defaultEndpointId={agent?.endpointId ?? null}
            onEndpointChange={state.overrides ? (endpointId) => {
              const ov = state.overrides;
              if (!ov) return;
              dispatch({ type: 'setOverrides', overrides: { ...ov, endpointId } });
            } : undefined}
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
          defaultToolCount={agent?.tools?.length ?? 0}
          hasAgentDefaults={!!agent}
          onChange={overrides => dispatch({ type: 'setOverrides', overrides })}
          onResetAll={() => agent && dispatch({ type: 'setOverrides', overrides: overridesFromAgent(agent) })}
        />
      )}
    </div>
  );
}
