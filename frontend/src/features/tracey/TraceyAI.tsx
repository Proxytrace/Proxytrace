import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTraceyChat } from './useTraceyChat';
import { TraceyActionsProvider } from './tracey-actions';
import { TraceyChatPanel } from './components/TraceyChatPanel';
import { ArtifactPanel } from './components/ArtifactPanel';

export default function TraceyAI() {
  const chat = useTraceyChat();

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
    <TraceyActionsProvider value={{ showArtifact: chat.showArtifact }}>
      <AssistantRuntimeProvider runtime={chat.runtime}>
        <div className="flex h-full min-h-0 gap-3">
          <TraceyChatPanel chat={chat} />
          {chat.artifacts.length > 0 && (
            <ArtifactPanel
              artifacts={chat.artifacts}
              activeId={chat.activeArtifactId}
              onSelect={chat.selectArtifact}
              onClose={chat.clearArtifacts}
            />
          )}
        </div>
      </AssistantRuntimeProvider>
    </TraceyActionsProvider>
  );
}
