import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CopyButton } from '../ui/CopyButton';

interface ConfirmDialogProps {
  /** When set, the user must type this value to confirm (high-stakes deletes). Omit for a simple OK/Cancel. */
  entityName?: string;
  displayName?: string;
  title?: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  entityName,
  displayName,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  const [input, setInput] = useState('');
  const requireMatch = entityName !== undefined;
  const canConfirm = !requireMatch || input === entityName;

  return (
    <Modal
      title={title ?? `Delete "${displayName ?? entityName}"`}
      onClose={onCancel}
      headerActions={requireMatch ? <CopyButton text={entityName} label="Copy name" /> : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={!canConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {requireMatch ? (
        <>
          <p className="text-[13px] text-secondary m-0 mb-4">
            This action cannot be undone. Type <strong className="text-primary font-mono">{entityName}</strong> to confirm.
          </p>
          <Input
            autoFocus
            data-testid="confirm-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={entityName}
          />
        </>
      ) : (
        <p className="text-[13px] text-secondary m-0">
          {message ?? 'This action cannot be undone.'}
        </p>
      )}
    </Modal>
  );
}
