import { useEffect, type RefObject } from 'react';

/**
 * Subscribe an element to mouse-wheel zoom. Scroll up → `onZoomIn` (passed the cursor's clientX so
 * the caller can zoom toward it); scroll down → `onZoomOut`. Uses a non-passive native listener so
 * the page doesn't scroll underneath the gesture — React's synthetic `onWheel` is passive and can't
 * `preventDefault`.
 */
export function useWheelZoom(
  ref: RefObject<HTMLElement | null>,
  onZoomIn: (clientX: number) => void,
  onZoomOut: () => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      if (e.deltaY < 0) onZoomIn(e.clientX);
      else onZoomOut();
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref, onZoomIn, onZoomOut]);
}
