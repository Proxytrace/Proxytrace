import { useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTraceyChatContext } from './tracey-chat-context';
import { TraceyChatPanel } from './components/TraceyChatPanel';

export default function TraceyAI() {
  // The chat lives in a provider above the router, so the conversation survives navigation
  // between routes — this page only renders the (already-running) runtime.
  const chat = useTraceyChatContext();
  const { activate } = chat;
  const { t } = useLingui();

  // Provision the session only once the user actually opens Tracey (it has backend side
  // effects). It stays active afterward, so the conversation persists across navigation.
  useEffect(() => activate(), [activate]);

  if (chat.status === 'no-project') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState title={t`No project selected`} description={t`Pick a project to chat with Tracey.`} />
      </div>
    );
  }
  if (chat.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          title={t`Couldn't start Tracey`}
          description={t`Tracey's session failed to start. Try again in a moment.`}
        />
      </div>
    );
  }

  // The runtime + actions providers are mounted app-wide in Shell (above the router) so the
  // conversation survives navigation — this page only renders the already-running runtime.
  return (
    <div className="flex h-full min-h-0">
      <TraceyChatPanel chat={chat} />
    </div>
  );
}
