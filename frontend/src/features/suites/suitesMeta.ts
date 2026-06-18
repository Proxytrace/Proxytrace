import { PASS_RATE_WARN, PASS_RATE_DANGER } from '../../lib/constants';

/** Derive the CSS-variable colour string for a pass-rate value. */
export function passRateColor(passRate: number | null): string {
  if (passRate === null) return 'var(--text-muted)';
  if (passRate >= PASS_RATE_WARN) return 'var(--success)';
  if (passRate >= PASS_RATE_DANGER) return 'var(--warn)';
  return 'var(--danger)';
}

/** Tailwind text-color class for a pass-rate value — the class-based sibling of {@link passRateColor},
 * for components (like {@link StatCell}) that take a `valueClass` rather than a runtime colour. */
export function passRateTextClass(passRate: number | null): string {
  if (passRate === null) return 'text-muted';
  if (passRate >= PASS_RATE_WARN) return 'text-success';
  if (passRate >= PASS_RATE_DANGER) return 'text-warn';
  return 'text-danger';
}
