import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '../icons';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<ModalSize, number> = { sm: 560, md: 720, lg: 960, xl: 1180 };

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  size?: ModalSize;
}

export function Modal({ title, onClose, children, footer, maxWidth, size }: ModalProps) {
  const resolvedMaxWidth = maxWidth ?? (size ? SIZE_PX[size] : SIZE_PX.sm);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        data-testid="modal-panel"
        className="modal-panel fade-up"
        style={{ maxWidth: `min(${resolvedMaxWidth}px, 94vw)`, width: '100%' }}
      >
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
    </div>,
    document.body,
  );
}

interface ModalFooterProps {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

export function ModalFooter({ onCancel, onSubmit, submitLabel, loading, disabled, danger }: ModalFooterProps) {
  return (
    <>
      <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      <button
        data-write
        data-testid="modal-submit"
        className={danger ? 'btn-danger' : 'btn-primary'}
        onClick={onSubmit}
        disabled={loading || disabled}
      >
        {submitLabel}
      </button>
    </>
  );
}
