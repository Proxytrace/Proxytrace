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
          <button data-write className="btn-danger" onClick={onConfirm} disabled={!match || loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-secondary m-0 mb-4">
        This action cannot be undone. Type <strong className="text-primary">{entityName}</strong> to confirm.
      </p>
      <input
        autoFocus
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={entityName}
        className="w-full px-3 py-[9px] bg-surface border border-border rounded-lg text-[13px] text-primary font-[inherit] outline-none"
      />
    </Modal>
  );
}
