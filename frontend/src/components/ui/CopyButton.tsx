import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { CopyIcon, CheckIcon } from '../icons';
import { cn } from '../../lib/cn';

interface Props {
  text: string;
  label?: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * Icon-only copy-to-clipboard control.
 *
 * Stops click propagation so it can sit inside hoverable / clickable surfaces
 * (e.g. a collapsible message header) without triggering them.
 */
export function CopyButton({ text, label, className, 'data-testid': testId }: Props) {
  const { t } = useLingui();
  const labelText = label ?? t`Copy`;
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* ignore */ });
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? t`Copied` : labelText}
      title={labelText}
      data-testid={testId}
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-sm cursor-pointer',
        'bg-card border border-border transition-colors duration-150 hover:bg-card-2',
        copied ? 'text-success' : 'text-muted',
        className,
      )}
    >
      {copied ? <CheckIcon size={12} strokeWidth={2.5} /> : <CopyIcon size={12} strokeWidth={2} />}
    </button>
  );
}
