import { createPortal } from 'react-dom';
import { XIcon } from '../../../../components/icons';
import { Button, IconButton } from '../../../../components/ui/Button';

interface Props {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DiscardConfirm({ count, onCancel, onConfirm }: Props) {
  return createPortal(
    <div
      className="modal-overlay z-[100]"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal-panel fade-up max-w-[min(440px,94vw)] w-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="m-0 text-base font-bold text-primary">Discard changes?</h2>
          <IconButton onClick={onCancel} aria-label="Close"><XIcon size={14} /></IconButton>
        </div>
        <p className="text-[13px] text-secondary m-0">
          You have {count} unsaved {count === 1 ? 'change' : 'changes'}. Closing now will discard{' '}
          {count === 1 ? 'it' : 'them'}.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Keep editing</Button>
          <Button variant="danger" onClick={onConfirm}>Discard</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
