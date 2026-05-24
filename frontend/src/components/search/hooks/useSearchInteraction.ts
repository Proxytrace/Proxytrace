import { useEffect, useRef, useState } from 'react';

interface UseSearchInteractionOptions {
  onClose: () => void;
}

/**
 * Manages the debounced query string and click-outside close behaviour.
 * Both are genuinely-external side-effects: a timer and a DOM event listener.
 */
export function useSearchInteraction({ onClose }: UseSearchInteractionOptions) {
  const [raw, setRaw] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce raw → debounced (external: timer)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(raw.trim()), 180);
    return () => clearTimeout(handle);
  }, [raw]);

  // Close on click outside (external: DOM event)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onClose();
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [onClose]);

  return { raw, setRaw, debounced, open, setOpen, wrapperRef };
}
