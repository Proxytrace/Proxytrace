import { Button } from '../../../../components/ui/Button';

interface Props {
  dirtyCount: number;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function EditSuiteFooter({ dirtyCount, saving, onCancel, onSave }: Props) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-hairline">
      <span className="text-[11.5px] text-muted">
        {dirtyCount === 0 ? 'Up to date' : `Save will apply ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}.`}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          data-testid="edit-suite-save-btn"
          onClick={onSave}
          loading={saving}
          disabled={dirtyCount === 0}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
