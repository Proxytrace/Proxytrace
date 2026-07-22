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

/**
 * `FOCUS_RING` at the same strength, for a composite text field whose *wrapper* draws the frame
 * (DESIGN §7) — the inner `<textarea>` is borderless, so the ring belongs on the frame around it.
 * Scoped to the text control rather than plain `focus-within:` so that a focusable sibling inside
 * the frame (a Send button) lights only its own ring: a lit frame keeps meaning "typing lands here".
 * Pair it with `transition-[border-color,box-shadow]` — a ring is a box-shadow, which
 * `transition-colors` does not animate.
 */
export const FOCUS_RING_FIELD =
  'has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]';

/** Short prefix length for displaying truncated entity IDs. */
export const ID_SHORT_LEN = 8;

/**
 * Hard cap on the number of model endpoints a single suite run (or schedule) may target.
 * Mirrors the backend invariant (`ITestRunGroup.MaxModelEndpoints`); the API rejects more.
 */
export const MAX_RUN_ENDPOINTS = 3;

/**
 * Hard cap on the number of samples (repeated runs) per endpoint in one run.
 * Mirrors the backend invariant (`ITestRunGroup.MaxSampleCount`); the API rejects more.
 */
export const MAX_SAMPLE_COUNT = 5;

// Features that fetch list data use pageSize=200 intentionally to avoid
// implementing paginated views for low-volume lists. A future migration
// should add server-side pagination and use the <Pagination> component
// consistently across all features.
export const LIST_PAGE_SIZE = 200;
