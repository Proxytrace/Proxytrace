import { Trans } from '@lingui/react/macro';
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
    <div className="rounded-lg bg-card-2 border border-border p-2.5 flex flex-col gap-2">
      <Textarea
        className="mono text-body"
        rows={Math.min(20, Math.max(3, draft.split('\n').length + 1))}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        autoFocus
        data-testid="editable-message-input"
      />
      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}><Trans>Cancel</Trans></Button>
        <Button variant="primary" onClick={onSave} data-testid="editable-message-save"><Trans>Save</Trans></Button>
      </div>
    </div>
  );
}
