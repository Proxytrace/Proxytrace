import { useEffect, useRef, useState } from 'react';

export function useElementWidth<T extends HTMLElement = HTMLDivElement>(fallback = 0) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}
