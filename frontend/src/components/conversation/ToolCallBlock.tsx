import { Trans } from '@lingui/react/macro';
import { JsonBlock } from '../ui/JsonBlock';

interface Props {
  name: string;
  /** Tool-call id; the first 12 chars are shown as a subtle reference. */
  id?: string;
  /** Raw arguments (JSON string or already-parsed value). */
  arguments: unknown;
}

/**
 * The shared presentation for a single tool call (name + arguments), success-tinted to
 * match the tool styling used across the app. Unlike `ToolMessageBubble` this does not
 * pair a result — use it where a call is shown on its own (e.g. the playground editor).
 */
export function ToolCallBlock({ name, id, arguments: args }: Props) {
  return (
    <div className="rounded-md p-2.5 border border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-success-subtle">
      <div className="flex items-center gap-2 text-body-sm mono mb-1.5">
        <span className="inline-flex items-center px-1.5 py-0.25 rounded-full text-caption font-bold bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-success">
          <Trans>tool call</Trans>
        </span>
        <span className="font-bold text-success">{name}</span>
        {id && <span className="text-muted text-caption">{id.slice(0, 12)}</span>}
      </div>
      <JsonBlock value={args} hideCopy transparent maxHeight={180} className="!px-0 !py-0" />
    </div>
  );
}
