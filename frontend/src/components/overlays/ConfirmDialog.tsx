import { useState } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  entityName: string;
  displayName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({ entityName, displayName, onConfirm, onCancel, loading }: ConfirmDialogProps) {
  const [input, setInput] = useState('');
  const match = input === entityName;

  return (
    <Modal
      title={`Delete "${displayName ?? entityName}"`}
      onClose={onCancel}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={!match || loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        This action cannot be undone. Type <strong style={{ color: 'var(--text-primary)' }}>{entityName}</strong> to confirm.
      </p>
      <input
        autoFocus
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={entityName}
        style={{
          width: '100%', padding: '9px 12px',
          background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
          borderRadius: '8px', fontSize: '13px', color: 'var(--text-primary)',
          fontFamily: 'inherit', outline: 'none',
        }}
      />
    </Modal>
  );
}
