import { useEffect } from 'react';
import { XIcon } from '../icons';

interface DrawerProps {
  title?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  children: React.ReactNode;
  subtitle?: string;
}

export function Drawer({ title, onClose, onPrev, onNext, children, subtitle }: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[49]"
        onClick={onClose}
      />
      <div className="drawer-panel fade-up">
        <div className="px-6 py-5 border-b border-hairline flex items-center gap-3 shrink-0">
          {(onPrev || onNext) && (
            <div className="flex gap-1">
              <button
                onClick={onPrev}
                disabled={!onPrev}
                style={{ opacity: onPrev ? 1 : 0.3 }}
                className={`w-7 h-7 rounded-md bg-card border border-border text-secondary text-[13px] ${onPrev ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >←</button>
              <button
                onClick={onNext}
                disabled={!onNext}
                style={{ opacity: onNext ? 1 : 0.3 }}
                className={`w-7 h-7 rounded-md bg-card border border-border text-secondary text-[13px] ${onNext ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >→</button>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <div className="text-sm font-bold text-primary truncate">
                {title}
              </div>
            )}
            {subtitle && (
              <div className="text-xs text-muted mt-[2px]">{subtitle}</div>
            )}
          </div>
          <button onClick={onClose} className="btn-icon"><XIcon size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {children}
        </div>
      </div>
    </>
  );
}
