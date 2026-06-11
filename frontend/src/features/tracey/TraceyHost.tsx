import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useTraceyChat } from './useTraceyChat';
import { TraceyChatProvider } from './tracey-chat-context';
import { TraceyActionsProvider } from './tracey-actions';

/**
 * Mounts the app-wide Tracey chat (runtime + context providers) around the routed page
 * content. Mounted once in `Shell` above the router `Outlet` — assistant-ui keeps the
 * conversation's message state inside the provider subtree, so mounting it per-route would
 * destroy the thread on every navigation.
 *
 * Default-exported and lazy-loaded so the whole Tracey stack (assistant-ui, the ai SDK,
 * tool definitions, and the bundled docs index) stays out of the main chunk.
 */
export default function TraceyHost({ children }: { children: React.ReactNode }) {
  const traceyChat = useTraceyChat();
  return (
    <TraceyChatProvider value={traceyChat}>
      <TraceyActionsProvider value={{ navigate: traceyChat.navigate }}>
        <AssistantRuntimeProvider runtime={traceyChat.runtime}>
          {children}
        </AssistantRuntimeProvider>
      </TraceyActionsProvider>
    </TraceyChatProvider>
  );
}
