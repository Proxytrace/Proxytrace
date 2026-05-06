import { useState } from 'react';

export function useFilter<T, F>(
  items: T[],
  filterFn: (item: T, filter: F) => boolean,
  initial: F,
): { filter: F; setFilter: (f: F) => void; filtered: T[] } {
  const [filter, setFilter] = useState<F>(initial);
  const filtered = items.filter(item => filterFn(item, filter));
  return { filter, setFilter, filtered };
}
