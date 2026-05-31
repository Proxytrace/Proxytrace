import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTraceyChatContext } from './tracey-chat-context';
import { TraceyActionsProvider } from './tracey-actions';
import { TraceyChatPanel } from './components/TraceyChatPanel';

export default function TraceyAI() {
  // The chat lives in a provider above the router, so the conversation survives navigation
  // between routes — this page only renders the (already-running) runtime.
  const chat = useTraceyChatContext();

  if (chat.status === 'no-project') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState title="No project selected" description="Pick a project to chat with Tracey." />
      </div>
    );
  }
  if (chat.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          title="Couldn't start Tracey"
          description="Tracey's session failed to start. Try again in a moment."
        />
      </div>
    );
  }

  return (
    <TraceyActionsProvider value={{ sendUserMessage: chat.sendUserMessage, navigate: chat.navigate }}>
      <AssistantRuntimeProvider runtime={chat.runtime}>
        <div className="flex h-full min-h-0">
          <TraceyChatPanel chat={chat} />
        </div>
      </AssistantRuntimeProvider>
    </TraceyActionsProvider>
  );
}
