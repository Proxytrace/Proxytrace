import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Button } from '../ui/Button';
import { ZapFilledIcon } from '../icons';
import { cn } from '../../lib/cn';
import { useTraceyChatContext } from '../../features/tracey/tracey-chat-context';

interface Props {
  /** The prompt to send; pass a function to build it lazily at click time. */
  prompt: string | (() => string);
  'data-testid': string;
  className?: string;
  /** Custom label; defaults to "Ask Tracey". */
  children?: ReactNode;
}

/**
 * The app-wide context-aware "Ask Tracey" chip: cyan accent tag with a glinting bolt. Clicking
 * it jumps to the Tracey AI page and sends the given prompt as a fresh conversation
 * (`TraceyChat.askTracey`). Renders nothing when Tracey is unavailable here (Free license,
 * non-interactive kiosk, or no project) — same gating as the sidebar nav entry.
 */
export function AskTraceyButton({ prompt, className, children, 'data-testid': testId }: Props) {
  const { askTracey, available } = useTraceyChatContext();
  if (!available) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      data-write
      data-testid={testId}
      onClick={() => askTracey(typeof prompt === 'function' ? prompt() : prompt)}
      leftIcon={<ZapFilledIcon size={12} className="tracey-bolt" />}
      className={cn(
        'rounded-none text-accent-text bg-accent-subtle hover:text-accent-hover shrink-0',
        className,
      )}
    >
      {children ?? <Trans>Ask Tracey</Trans>}
    </Button>
  );
}
