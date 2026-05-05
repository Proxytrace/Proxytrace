import { useEffect } from 'react';

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
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49 }}
        onClick={onClose}
      />
      <div className="drawer-panel fade-up">
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          {(onPrev || onNext) && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={onPrev}
                disabled={!onPrev}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)', fontSize: '13px',
                  opacity: onPrev ? 1 : 0.3, cursor: onPrev ? 'pointer' : 'not-allowed',
                }}
              >←</button>
              <button
                onClick={onNext}
                disabled={!onNext}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)', fontSize: '13px',
                  opacity: onNext ? 1 : 0.3, cursor: onNext ? 'pointer' : 'not-allowed',
                }}
              >→</button>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', padding: '4px 6px', borderRadius: '6px', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {children}
        </div>
      </div>
    </>
  );
}
