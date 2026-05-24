// Synchronizes with the system clock — a genuinely external effect (setInterval).
// Per BEST_PRACTICES §4.1: timer subscriptions belong in a hook, not inline in the page.

import { useEffect, useState } from 'react';

function currentUtcTime(): string {
  return new Date().toISOString().slice(11, 19);
}

/** Returns the current UTC time string (HH:mm:ss), updated every second. */
export function useLiveClock(): string {
  const [clock, setClock] = useState(currentUtcTime);

  useEffect(() => {
    const id = setInterval(() => setClock(currentUtcTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return clock;
}
