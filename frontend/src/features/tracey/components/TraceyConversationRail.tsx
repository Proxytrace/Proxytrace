import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { ListRail } from '../../../components/ui/ListRail';
import { RowButton } from '../../../components/ui/RowButton';
import { IconButton } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { TrashIcon } from '../../../components/icons';
import { fmtRelative } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import { selectionRowStyle, selectionBarStyle, SELECTION_ROW_INACTIVE } from '../../../lib/selectionRow';
import type { TraceyChat } from '../useTraceyChat';

interface TraceyConversationRailProps {
  chat: TraceyChat;
}

// Tracey's accent hue drives the selected-row wash + left bar (a runtime color for `style`, per
// DESIGN.md §6 — the selectionRow helpers are built for exactly this).
const ACCENT = 'var(--accent-primary)';

/**
 * The conversation-history rail on the right edge of the Tracey page (collapsed by default;
 * toggled from the chat panel header). Lists the stored conversations (newest first), highlights
 * the active one, and lets the user start a new conversation, open a past one (view == continue),
 * or delete one. Purely presentational — all state + persistence live in {@link useTraceyChat}.
 */
export function TraceyConversationRail({ chat }: TraceyConversationRailProps) {
  const { t } = useLingui();
  const { conversations, activeConversationId, selectConversation, deleteConversation, startNewConversation } = chat;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const pendingDelete = conversations.find(c => c.id === pendingDeleteId) ?? null;

  return (
    <>
      <ListRail
        title={t`Conversations`}
        count={conversations.length}
        create={{ onClick: startNewConversation, label: t`New conversation`, testId: 'tracey-new-conversation' }}
        railTestId="tracey-conversation-rail"
        listTestId="tracey-conversation-list"
        isEmpty={sorted.length === 0}
        empty={
          <EmptyState
            title={t`No conversations yet`}
            description={t`Start chatting to build your history.`}
          />
        }
      >
        <div className="flex flex-col gap-1">
          {sorted.map(c => {
            const active = c.id === activeConversationId;
            return (
              <div
                key={c.id}
                className="group relative"
                data-testid={`tracey-conversation-row-${c.id}`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                    style={selectionBarStyle(ACCENT)}
                  />
                )}
                <RowButton
                  onClick={() => selectConversation(c.id)}
                  aria-current={active || undefined}
                  style={active ? selectionRowStyle(ACCENT) : undefined}
                  className={cn('rounded-md px-2.5 py-2 pr-9', !active && SELECTION_ROW_INACTIVE)}
                  data-testid={`tracey-conversation-select-${c.id}`}
                >
                  <div className="truncate text-body-sm font-medium text-primary" data-testid={`tracey-conversation-title-${c.id}`}>
                    {c.title || t`New conversation`}
                  </div>
                  <div className="mt-0.5 text-caption text-muted">
                    {fmtRelative(new Date(c.updatedAt).toISOString())}
                  </div>
                </RowButton>
                <IconButton
                  size="sm"
                  danger
                  onClick={() => setPendingDeleteId(c.id)}
                  aria-label={t`Delete conversation`}
                  title={t`Delete conversation`}
                  data-testid={`tracey-conversation-delete-${c.id}`}
                  className="absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-[var(--motion-base)] group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <TrashIcon size={14} />
                </IconButton>
              </div>
            );
          })}
        </div>
      </ListRail>

      {pendingDelete && (
        <ConfirmDialog
          title={t`Delete this conversation?`}
          message={t`"${pendingDelete.title}" will be permanently removed from this device.`}
          onConfirm={() => {
            deleteConversation(pendingDelete.id);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </>
  );
}
