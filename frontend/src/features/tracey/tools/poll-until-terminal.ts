// Pure poll loop with injectable timers — no React, no globals — so it is unit-testable
// without real delays. Calls `poll` until `isTerminal` holds or `timeoutMs` elapses; on
// timeout it returns the last snapshot with `timedOut: true` rather than throwing. The
// timeout is checked before each sleep, so the loop may overshoot the cap by up to `intervalMs`.

export interface PollOptions {
  /** Delay between polls, in ms. */
  intervalMs: number;
  /** Overall cap, in ms. After this elapses the loop gives up with `timedOut: true`. */
  timeoutMs: number;
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
  if (opts.signal?.aborted) throw abortError();
  let snapshot = await poll();
  while (!isTerminal(snapshot)) {
    if (opts.now() - start >= opts.timeoutMs) return { snapshot, timedOut: true };
    await opts.sleep(opts.intervalMs);
    if (opts.signal?.aborted) throw abortError();
    snapshot = await poll();
  }
  return { snapshot, timedOut: false };
}
