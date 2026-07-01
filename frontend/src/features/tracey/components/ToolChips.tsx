import { useComposerRuntime } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../lib/cn';
import { QUICK_ACTIONS } from '../tracey-quick-actions';

const RING = cn(
  'rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
);

/** Starter chips above the composer that surface available quick-actions; clicking one sends its prompt. */
export function ToolChips() {
  const composer = useComposerRuntime();
  const { i18n } = useLingui();

  const sendPrompt = (prompt: string) => {
    composer.setText(prompt);
    composer.send();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {QUICK_ACTIONS.map(action => (
        // eslint-disable-next-line no-restricted-syntax -- Badge-wrapping quick-action chip (sends the prompt)
        <button
          key={action.id}
          type="button"
          title={i18n._(action.hint)}
          onClick={() => sendPrompt(action.prompt)}
          className={RING}
        >
          <Badge label={i18n._(action.label)} variant="accent" shape="pill" size="sm" />
        </button>
      ))}
    </div>
  );
}
