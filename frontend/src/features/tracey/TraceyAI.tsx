import { useEffect, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';
import { useTraceyChatContext } from './tracey-chat-context';
import { loadRailCollapsed, saveRailCollapsed } from './tracey-storage';
import { TraceyChatPanel } from './components/TraceyChatPanel';
import { TraceyConversationRail } from './components/TraceyConversationRail';

export default function TraceyAI() {
  // The chat lives in a provider above the router, so the conversation survives navigation
  // between routes — this page only renders the (already-running) runtime.
  const chat = useTraceyChatContext();
  const { activate } = chat;
  const { t } = useLingui();
  // The conversation rail is collapsible and starts collapsed; the preference persists in
  // localStorage because this page unmounts on navigation (only the chat runtime lives above
  // the router).
  const [railCollapsed, setRailCollapsed] = useState(loadRailCollapsed);
  const toggleRail = () => {
    setRailCollapsed(v => {
      saveRailCollapsed(!v);
      return !v;
    });
  };

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
  // The chat panel fills the page; the conversation-history rail sits on the RIGHT (mirroring
  // the rail column width used by the master/detail views) and is hidden while collapsed
  // (the default), handing the chat the full width.
  return (
    <div
      className={cn(
        'grid h-full min-h-0 gap-4',
        railCollapsed ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_minmax(248px,320px)]',
      )}
    >
      <TraceyChatPanel chat={chat} railCollapsed={railCollapsed} onToggleRail={toggleRail} />
      {!railCollapsed && <TraceyConversationRail chat={chat} />}
    </div>
  );
}
