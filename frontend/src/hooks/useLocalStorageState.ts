import { useCallback, useState } from 'react';

/**
 * `useState` mirrored to `localStorage`. Availability-safe: falls back to `initial` when
 * storage is unavailable (private mode, quota, SSR) or holds invalid JSON, and swallows
 * write failures rather than crashing the render.
 */
export function useLocalStorageState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, initial));

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage unavailable or over quota — keep the in-memory value only
      }
    },
    [key],
  );

  return [value, set];
}

function readStored<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}
