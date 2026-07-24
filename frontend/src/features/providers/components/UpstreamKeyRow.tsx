import { useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ProviderDto } from '../../../api/models';
import { CopyIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import useToast from '../../../hooks/useToast';
import { cn } from '../../../lib/cn';
import { ProviderConnectionTestError, providerConnectionErrorMessage } from '../../../lib/providerConnection';
import { maskKey } from '../providerMeta';
import { useRotateUpstreamKey } from '../hooks/useProviderMutations';

interface UpstreamKeyRowProps {
  provider: ProviderDto;
}

type Feedback = { tone: 'error' | 'warning'; message: string };

export function UpstreamKeyRow({ provider }: UpstreamKeyRowProps) {
  const { t, i18n } = useLingui();
  const { show: toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rotateKey = useRotateUpstreamKey(provider);
  const normalizedDraft = draft.trim();
  const canSave = normalizedDraft.length > 0
    && normalizedDraft !== provider.upstreamApiKey
    && !rotateKey.isPending;
  const inputSize = 'sm' as const;

  function startEditing() {
    setDraft('');
    setFeedback(null);
    setIsRevealed(false);
    setIsEditing(true);
  }

  function focusEditButton() {
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }

  function save() {
    if (!canSave || rotateKey.isPending) return;
    setFeedback(null);
    rotateKey.mutate(normalizedDraft, {
      onSuccess: result => {
        setDraft('');
        setIsEditing(false);
        setIsRevealed(false);
        focusEditButton();
        setFeedback(result.modelCount === 0
          ? { tone: 'warning', message: t`Key accepted, but the provider reported no models.` }
          : null);
      },
      onError: error => {
        const message = error instanceof ProviderConnectionTestError
          ? providerConnectionErrorMessage(i18n, {
              errorCode: error.errorCode,
              error: error.serverError,
              errorId: error.errorId,
            })
          : t`Could not update the upstream API key.`;
        setFeedback({ tone: 'error', message });
        requestAnimationFrame(() => inputRef.current?.focus());
      },
    });
  }

  function copyKey() {
    void navigator.clipboard.writeText(provider.upstreamApiKey);
    // eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy
    toast(t`Upstream key copied`, 'success');
  }

  return (
    <div className="mt-4 px-3.5 py-2.5 bg-card-2 rounded-md border border-hairline">
      <div className="flex items-center gap-2.5 flex-wrap">
        <label htmlFor={isEditing ? 'provider-upstream-key-input' : undefined} className="text-body-sm text-secondary whitespace-nowrap">
          <Trans>Upstream API key</Trans>
        </label>
        {isEditing ? (
          <>
            <div className="flex-1 min-w-48">
              <Input
                ref={inputRef}
                id="provider-upstream-key-input"
                data-testid="provider-upstream-key-input"
                type="password"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') save(); }}
                placeholder={t`sk-…`}
                autoComplete="new-password"
                autoFocus
                inputSize={inputSize}
                className="font-mono"
              />
            </div>
            <Button
              data-testid="provider-upstream-key-save-btn"
              data-write
              size="sm"
              variant="primary"
              loading={rotateKey.isPending}
              disabled={!canSave}
              onClick={save}
            >
              <Trans>Save</Trans>
            </Button>
            <Button
              data-testid="provider-upstream-key-cancel-btn"
              size="sm"
              variant="ghost"
              disabled={rotateKey.isPending}
              onClick={() => { setIsEditing(false); focusEditButton(); }}
            >
              <Trans>Cancel</Trans>
            </Button>
          </>
        ) : (
          <>
            <code className="flex-1 font-mono text-body text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
              {isRevealed ? provider.upstreamApiKey : maskKey(provider.upstreamApiKey)}
            </code>
            <Button
              data-testid="provider-upstream-key-reveal-btn"
              size="sm"
              variant="ghost"
              onClick={() => setIsRevealed(value => !value)}
            >
              {isRevealed ? <Trans>Hide</Trans> : <Trans>Reveal</Trans>}
            </Button>
            <Button
              data-testid="provider-upstream-key-copy-btn"
              size="sm"
              variant="ghost"
              leftIcon={<CopyIcon size={12} />}
              onClick={copyKey}
            >
              <Trans>Copy</Trans>
            </Button>
            <Button
              ref={editButtonRef}
              data-testid="provider-upstream-key-edit-btn"
              data-write
              size="sm"
              variant="ghost"
              onClick={startEditing}
            >
              <Trans>Edit</Trans>
            </Button>
          </>
        )}
      </div>
      {rotateKey.phase === 'verifying' && (
        <div className="mt-2 flex items-center gap-1.5 text-body-sm text-secondary" data-testid="provider-upstream-key-feedback">
          <Spinner size={12} />
          <Trans>Verifying key…</Trans>
        </div>
      )}
      {feedback && rotateKey.phase !== 'verifying' && (
        <p
          className={cn('mt-2 text-body-sm', feedback.tone === 'warning' ? 'text-warn' : 'text-danger')}
          data-testid="provider-upstream-key-feedback"
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
