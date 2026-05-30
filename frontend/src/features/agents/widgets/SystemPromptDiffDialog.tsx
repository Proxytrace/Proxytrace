import { Modal } from '../../../components/overlays/Modal';
import { diffLines, type DiffKind } from '../diffLines';

interface Props {
  previousLabel: string;
  currentLabel: string;
  previous: string;
  current: string;
  onClose: () => void;
}

const ROW_CLS: Record<DiffKind, string> = {
  same: 'text-secondary',
  add: 'bg-success-subtle text-success',
  del: 'bg-danger-subtle text-danger',
};

const SIGN: Record<DiffKind, string> = { same: ' ', add: '+', del: '-' };

export function SystemPromptDiffDialog({ previousLabel, currentLabel, previous, current, onClose }: Props) {
  const rows = diffLines(previous, current);
  const added = rows.filter(r => r.kind === 'add').length;
  const removed = rows.filter(r => r.kind === 'del').length;

  return (
    <Modal title={`System Prompt · ${previousLabel} → ${currentLabel}`} onClose={onClose} maxWidth={860}>
      <div className="flex items-center gap-3 mb-3 text-body-sm">
        <span className="text-success font-semibold">+{added} added</span>
        <span className="text-danger font-semibold">−{removed} removed</span>
      </div>
      <div
        className="rounded-md bg-surface overflow-auto max-h-[60vh] font-mono text-body leading-[1.6]"
        data-testid="system-prompt-diff"
      >
        {rows.map((row, i) => (
          <div key={i} className={`flex gap-2 px-3 py-0.5 whitespace-pre-wrap ${ROW_CLS[row.kind]}`}>
            <span className="select-none shrink-0 w-3 text-center opacity-70">{SIGN[row.kind]}</span>
            <span className="min-w-0 break-words">{row.text || ' '}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
