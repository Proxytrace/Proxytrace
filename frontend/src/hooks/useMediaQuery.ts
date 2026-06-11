import { useSyncExternalStore } from 'react';

/**
 * Reactive `window.matchMedia` — re-renders when the query starts/stops matching.
 * Use for behavior that CSS can't express (swapping component trees, touch vs pointer
 * branches); pure styling differences belong in Tailwind breakpoints, not here.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

/** True below Tailwind's `md` breakpoint — the cutoff where the app switches to mobile chrome. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
