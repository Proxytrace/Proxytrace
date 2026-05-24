import { useEffect } from 'react';

/** Wires Escape → close and Left/Right arrows → prev/next for a drawer. */
export function useDrawerKeys({
  onClose,
  onPrev,
  onNext,
}: {
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);
}
