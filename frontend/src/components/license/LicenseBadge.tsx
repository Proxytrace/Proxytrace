import { Pill } from '../ui/Pill';
import { useLicense } from '../../api/license';

const TIER_LABEL = { free: 'Free', enterprise: 'Enterprise' } as const;

/**
 * Tier pill shown beside the health pill in the top bar. Rendered only for a
 * licensed install (status other than `free`) so the default experience stays
 * unbranded.
 */
export function LicenseBadge() {
  const { data } = useLicense();
  if (!data || data.status === 'free') return null;

  const color = data.status === 'active' ? 'var(--success)' : 'var(--warn)';

  return (
    <span data-testid="license-badge">
      <Pill label={TIER_LABEL[data.tier]} color={color} size="sm" />
    </span>
  );
}
