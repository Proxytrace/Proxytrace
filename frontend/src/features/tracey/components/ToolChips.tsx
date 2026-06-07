import { useComposerRuntime } from '@assistant-ui/react';
import { Badge } from '../../../components/ui/Badge';
import { QUICK_ACTIONS } from '../tracey-quick-actions';

const RING =
  'rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]';

/** Chips above the composer that surface available quick-actions; clicking prefills the composer. */
export function ToolChips() {
  const composer = useComposerRuntime();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {QUICK_ACTIONS.map(action => (
        // eslint-disable-next-line no-restricted-syntax -- Badge-wrapping quick-action chip (composer prefill)
        <button
          key={action.id}
          type="button"
          title={action.hint}
          onClick={() => composer.setText(action.prompt)}
          className={RING}
        >
          <Badge label={action.label} variant="accent" shape="pill" size="sm" />
        </button>
      ))}
      <span className="ml-1 text-[11px] text-muted">
        or type <span className="font-mono text-secondary">/</span> for tools
      </span>
    </div>
  );
}
