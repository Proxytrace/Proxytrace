import { useEffect, type RefObject } from 'react';

interface AutosizeBounds {
  min?: number;
  max?: number;
}

/**
 * Grows/shrinks a textarea to fit its content (clamped to [min, max] px) whenever `value` changes.
 * Wraps the one legitimate DOM-measurement effect (BEST_PRACTICES §4.1) so the component stays
 * declarative — pass the textarea ref and the controlled value.
 */
export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { min = 60, max = 220 }: AutosizeBounds = {},
) {
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(max, Math.max(min, ta.scrollHeight))}px`;
  }, [ref, value, min, max]);
}
