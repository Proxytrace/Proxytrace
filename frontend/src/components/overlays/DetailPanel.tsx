import { useEffect } from 'react';

interface DetailPanelProps {
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** Disable Esc/Arrow handling while a nested overlay (e.g. a modal) owns the keyboard. */
  keyboardEnabled?: boolean;
  testId?: string;
  children: React.ReactNode;
}

/**
 * The shared right-side detail shell: a dimmed overlay plus a floating, rounded card pinned below
 * the top bar. Owns the chrome (positioning, elevation, enter animation, overlay/Esc/arrow close)
 * and nothing about the interior — features render their own header and body as children.
 */
export function DetailPanel({ onClose, onPrev, onNext, keyboardEnabled = true, testId, children }: DetailPanelProps) {
  useEffect(() => {
    if (!keyboardEnabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, keyboardEnabled]);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.4)]" />
      <div
        data-testid={testId}
        className="fixed top-[76px] right-[10px] bottom-[10px] w-[min(720px,92vw)] bg-card rounded-[18px] flex flex-col overflow-hidden z-[51] shadow-[var(--shadow-float)] [animation:fade-up_0.25s_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        {children}
      </div>
    </>
  );
}
