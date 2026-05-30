import { useCallback, useEffect, useState } from 'react';
import type { UpgradeErrorType } from '../../api/client';
import { Modal } from '../overlays/Modal';
import { Button } from '../ui/Button';
import { LockIcon } from '../icons';
import { upgradeCopy } from './licenseUtils';

const PRICING_URL = 'https://proxytrace.dev/pricing';

interface UpgradePrompt {
  errorType: UpgradeErrorType;
  /** Server-supplied explanation; shown verbatim when present. */
  message?: string;
}

let globalShow: ((prompt: UpgradePrompt) => void) | null = null;

/**
 * Imperatively opens the upgrade dialog. Wired into the QueryClient's
 * mutation/query error path (App.tsx) so any 402 license rejection surfaces a
 * clear, non-dead-end prompt instead of failing silently.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function showUpgradeModal(prompt: UpgradePrompt) {
  globalShow?.(prompt);
}

/**
 * Hosts the single upgrade dialog and registers the imperative entrypoint.
 * Mount once near the app root, beside ToastProvider.
 */
export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<UpgradePrompt | null>(null);

  const show = useCallback((next: UpgradePrompt) => setPrompt(next), []);

  useEffect(() => {
    globalShow = show;
    return () => { globalShow = null; };
  }, [show]);

  const close = useCallback(() => setPrompt(null), []);

  if (!prompt) return <>{children}</>;

  const copy = upgradeCopy(prompt.errorType);
  const body = prompt.message?.trim() || copy.fallback;

  return (
    <>
      {children}
      <Modal onClose={close} size="sm">
        <div data-testid="upgrade-modal" className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card-2 text-accent shadow-[var(--shadow-card)]">
            <LockIcon size={22} />
          </div>
          <div>
            <h2 className="text-h1 font-semibold text-primary">{copy.title}</h2>
            <p className="mt-2 text-body text-secondary">{body}</p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Button variant="secondary" onClick={close} data-testid="upgrade-modal-dismiss">
              Not now
            </Button>
            <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" data-testid="upgrade-modal-cta">
                View Enterprise plans
              </Button>
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
}
