import { useEffect } from 'react';

/**
 * Registers a keydown listener that fires `handler` when Escape is pressed.
 * This is a genuine external-system subscription and is the correct use of useEffect (§4.1).
 *
 * @param handler - Called when Escape is pressed.
 * @param deps    - Dependency array (the same values the handler closes over).
 */
export function useEscapeKey(handler: () => void, deps: unknown[]) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') handler(); };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
