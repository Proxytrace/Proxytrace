import { useEffect } from 'react';

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ title, onClose, children, footer, maxWidth = 560 }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel fade-up" style={{ maxWidth }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
            <button
              onClick={onClose}
              style={{ color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}
            >
              ✕
            </button>
          </div>
        )}
        {children}
        {footer && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
