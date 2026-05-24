export const PASS_RATE_WARN = 75;
export const PASS_RATE_DANGER = 55;
export const SCORE_WARN = 0.8;
export const SCORE_DANGER = 0.5;

export const REFETCH_INTERVAL_SLOW = 60_000;
export const REFETCH_INTERVAL_FAST = 30_000;
export const REFETCH_INTERVAL_LIVE = 15_000;

export const DEFAULT_PAGE_SIZE = 20;

/** Canonical visible focus ring (DESIGN §7). Reuse instead of re-declaring per file. */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]';

/** Short prefix length for displaying truncated entity IDs. */
export const ID_SHORT_LEN = 8;

// Features that fetch list data use pageSize=200 intentionally to avoid
// implementing paginated views for low-volume lists. A future migration
// should add server-side pagination and use the <Pagination> component
// consistently across all features.
export const LIST_PAGE_SIZE = 200;
