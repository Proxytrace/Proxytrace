import { useState, useEffect } from 'react';

/**
 * Debounces a string value by `delay` ms. The returned value only updates
 * after the input has been stable for the full delay. This wraps a timer
 * (external to React) per BEST_PRACTICES §4.1.
 */
export function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}
