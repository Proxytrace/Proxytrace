import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

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
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={!match} loading={loading}>
            Delete
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-secondary m-0 mb-4">
        This action cannot be undone. Type <strong className="text-primary">{entityName}</strong> to confirm.
      </p>
      <Input
        autoFocus
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={entityName}
      />
    </Modal>
  );
}
