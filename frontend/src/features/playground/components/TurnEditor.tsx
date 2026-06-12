import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';

interface Props {
  draft: string;
  setDraft: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

/** In-place editor a playground turn swaps to while its content is being edited. */
export function TurnEditor({ draft, setDraft, onCancel, onSave }: Props) {
  return (
    <div className="rounded-[12px] bg-card-2 border border-border p-[10px] flex flex-col gap-[8px]">
      <Textarea
        className="mono text-[12.5px]"
        rows={Math.min(20, Math.max(3, draft.split('\n').length + 1))}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        autoFocus
        data-testid="editable-message-input"
      />
      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onSave} data-testid="editable-message-save">Save</Button>
      </div>
    </div>
  );
}
