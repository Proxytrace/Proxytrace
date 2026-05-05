import { useEffect } from 'react';
import { XIcon } from '../icons';

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
          <div className="flex items-center justify-between mb-5">
            <h2 className="m-0 text-base font-bold text-primary">{title}</h2>
            <button onClick={onClose} className="btn-icon"><XIcon size={14} /></button>
          </div>
        )}
        {children}
        {footer && (
          <div className="mt-5 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
