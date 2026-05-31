import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { Drawer } from '../../components/overlays/Drawer';
import { useTraceyChat } from './useTraceyChat';
import { TraceyConversation } from './TraceyConversation';

interface TraceyDrawerProps {
  onClose: () => void;
}

export function TraceyDrawer({ onClose }: TraceyDrawerProps) {
  const {
    runtime,
    status,
    autoApprove,
    setAutoApprove,
    pendingConfirmation,
    resolveConfirmation,
    clear,
  } = useTraceyChat();

  return (
    <Drawer title="Tracey" subtitle="AI assistant" onClose={onClose}>
      <div className="flex items-center justify-between gap-2 -mt-1">
        <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="accent-[var(--accent-primary)]"
          />
          Auto-approve actions
        </label>
        <button onClick={clear} className="btn-ghost text-xs px-2 py-1">
          Clear conversation
        </button>
      </div>

      {status === 'no-project' && (
        <div className="text-sm text-muted">Select a project to chat with Tracey.</div>
      )}
      {status === 'error' && (
        <div className="text-sm text-danger">Couldn't start a Tracey session. Try again later.</div>
      )}

      {(status === 'ready' || status === 'loading') && (
        <AssistantRuntimeProvider runtime={runtime}>
          <div className="flex min-h-0 flex-1 flex-col">
            {pendingConfirmation && (
              <div className="mb-2 rounded-lg border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-warn-subtle px-3 py-2.5">
                <div className="text-[13px] text-primary">{pendingConfirmation.summary}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => resolveConfirmation(true)}
                    className="btn-primary px-3 py-1 text-xs"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => resolveConfirmation(false)}
                    className="btn-ghost px-3 py-1 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <TraceyConversation />
          </div>
        </AssistantRuntimeProvider>
      )}
    </Drawer>
  );
}
