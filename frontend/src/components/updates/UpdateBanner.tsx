import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useUpdateStatus } from '../../api/updates';
import { IconButton } from '../ui/Button';
import { ArrowUpFromLineIcon, XIcon } from '../icons';

// eslint-disable-next-line lingui/no-unlocalized-strings -- localStorage key, not UI copy
const DISMISSED_KEY = 'proxytrace-update-dismissed';

/**
 * Slim notice pinned above the top bar when a newer release is available. Admin-only
 * (the backing query only runs for admins) and dismissible per version: dismissing
 * stores the version in localStorage, so the banner returns for the next release.
 */
export function UpdateBanner() {
  const { t } = useLingui();
  const { data } = useUpdateStatus();
  const [dismissedVersion, setDismissedVersion] = useState(() => localStorage.getItem(DISMISSED_KEY));

  if (!data?.updateAvailable || !data.latestVersion) return null;
  if (data.latestVersion === dismissedVersion) return null;

  // Defensive: the URL comes from the release manifest — only ever link https.
  const releaseHref = data.releaseUrl?.startsWith('https://') ? data.releaseUrl : undefined;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, data.latestVersion ?? '');
    setDismissedVersion(data.latestVersion);
  };

  return (
    <div
      data-testid="update-banner"
      role="status"
      className="shrink-0 flex items-center gap-2 px-4 py-1.5 text-body-sm font-medium text-accent-text bg-accent-subtle border-b border-[var(--accent-border)]"
    >
      <ArrowUpFromLineIcon size={14} />
      <span>
        <Trans>
          Proxytrace <span className="font-mono">{data.latestVersion}</span> is available — you're
          running <span className="font-mono">{data.currentVersion}</span>.
        </Trans>
      </span>
      {releaseHref && (
        <a
          href={releaseHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-primary"
        >
          <Trans>Release notes</Trans>
        </a>
      )}
      <IconButton aria-label={t`Dismiss update notice`} className="ml-auto" onClick={dismiss} data-testid="update-banner-dismiss">
        <XIcon size={14} />
      </IconButton>
    </div>
  );
}
