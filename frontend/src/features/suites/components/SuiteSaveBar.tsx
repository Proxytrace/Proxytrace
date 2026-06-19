import { Trans, Plural } from '@lingui/react/macro';
import { Button } from '../../../components/ui/Button';

interface Props {
  /** Number of staged edits; the bar hides itself when zero. */
  count: number;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

/** Sticky footer of the suite workspace card. Surfaces the staged-edit count with Discard / Save
 * actions whenever the suite editor is dirty, and collapses to nothing when there is nothing to save. */
export function SuiteSaveBar({ count, saving, onDiscard, onSave }: Props) {
  if (count <= 0) return null;

  return (
    <div className="shrink-0 flex items-center gap-3 border-t border-hairline bg-card px-5 py-3">
      <span className="mr-auto text-body-sm font-semibold text-accent" data-testid="suite-dirty-count">
        <Plural value={count} one="# unsaved change" other="# unsaved changes" />
      </span>
      <Button variant="ghost" size="sm" onClick={onDiscard} data-testid="suite-discard-btn">
        <Trans>Discard</Trans>
      </Button>
      <Button variant="primary" size="sm" loading={saving} onClick={onSave} data-testid="edit-suite-save-btn">
        <Trans>Save changes</Trans>
      </Button>
    </div>
  );
}
