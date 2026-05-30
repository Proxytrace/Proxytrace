import { Link } from 'react-router-dom';
import { useLicense } from '../../api/license';
import { LockIcon } from '../icons';

/**
 * Slim warning bar pinned above the top bar when the install has exhausted its
 * monthly trace-ingestion quota. New traces are dropped until the quota resets,
 * so the user needs to know capture has paused.
 */
export function QuotaBanner() {
  const { data } = useLicense();
  if (!data?.quotaExceeded) return null;

  return (
    <div
      data-testid="license-quota-banner"
      role="status"
      className="shrink-0 flex items-center gap-2 px-4 py-1.5 text-body-sm font-medium text-warn bg-warn-subtle border-b border-[color-mix(in_srgb,var(--warn)_25%,transparent)]"
    >
      <LockIcon size={14} />
      <span>
        Monthly trace quota reached — new traces are being dropped until the quota resets next month.
      </span>
      <Link to="/upgrade" className="ml-auto underline underline-offset-2 hover:text-primary">
        View plans
      </Link>
    </div>
  );
}
