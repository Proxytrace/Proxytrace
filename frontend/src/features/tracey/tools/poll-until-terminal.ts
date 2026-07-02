// Pure poll loop with injectable timers — no React, no globals — so it is unit-testable
// without real delays. Calls `poll` until `isTerminal` holds or `timeoutMs` elapses; on
// timeout it returns the last snapshot with `timedOut: true` rather than throwing. The
// timeout is checked before each sleep, so the loop may overshoot the cap by up to `intervalMs`.

export interface PollOptions {
  /** Delay between polls, in ms. */
  intervalMs: number;
  /** Overall cap, in ms. After this elapses the loop gives up with `timedOut: true`. */
  timeoutMs: number;
  /**
   * How many *consecutive* poll failures to tolerate before giving up and rethrowing
   * (default 0 — first failure rejects). A long wait makes hundreds of polls, so a single
   * transient blip (network hiccup, backend restart, 5xx) must not void the whole wait;
   * only a persistent failure — e.g. a genuinely bad id 404ing on every poll — should.
   */
  maxConsecutiveFailures?: number;
  /** Sleeps for `ms` (injected so tests can advance a fake clock instantly). */
  sleep: (ms: number) => Promise<void>;
  /** Current time in ms (injected for the same reason). */
  now: () => number;
  /** Aborts the loop (user hit Stop). Checked around each sleep; throws an AbortError. */
  signal?: AbortSignal;
}

/** The error thrown when a poll loop is aborted; `name` matches the platform AbortError. */
export function abortError(): Error {
  return new DOMException('The wait was aborted.', 'AbortError');
}

export async function pollUntilTerminal<S>(
  poll: () => Promise<S>,
  isTerminal: (snapshot: S) => boolean,
  opts: PollOptions,
): Promise<{ snapshot: S; timedOut: boolean }> {
  const start = opts.now();
  const maxFailures = opts.maxConsecutiveFailures ?? 0;
  let consecutiveFailures = 0;
  let last: { snapshot: S } | undefined;
  let lastError: unknown;
  for (;;) {
    if (opts.signal?.aborted) throw abortError();
    try {
      const snapshot = await poll();
      last = { snapshot };
      consecutiveFailures = 0;
      if (isTerminal(snapshot)) return { snapshot, timedOut: false };
    } catch (e) {
      // An abort is a cancellation of the whole wait, never a retryable poll failure.
      if (e instanceof Error && e.name === 'AbortError') throw e;
      consecutiveFailures++;
      lastError = e;
      if (consecutiveFailures > maxFailures) throw e;
    }
    if (opts.now() - start >= opts.timeoutMs) {
      // Timed out while every poll so far failed: there is no snapshot to hand back.
      if (!last) throw lastError;
      return { snapshot: last.snapshot, timedOut: true };
    }
    await opts.sleep(opts.intervalMs);
  }
}
