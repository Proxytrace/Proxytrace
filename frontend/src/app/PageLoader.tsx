import { Trans } from '@lingui/react/macro';

/** Full-area "Loading…" placeholder shared by the auth gates and route Suspense boundaries. */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center flex-1 text-muted text-title">
      <Trans>Loading…</Trans>
    </div>
  );
}
