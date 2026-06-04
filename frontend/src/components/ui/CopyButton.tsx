import { useState } from 'react';
import { CopyIcon, CheckIcon } from '../icons';
import { cn } from '../../lib/cn';

interface Props {
  text: string;
  label?: string;
  className?: string;
}

/**
 * Icon-only copy-to-clipboard control.
 *
 * Stops click propagation so it can sit inside hoverable / clickable surfaces
 * (e.g. a collapsible message header) without triggering them.
 */
export function CopyButton({ text, label = 'Copy', className }: Props) {
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
      aria-label={copied ? 'Copied' : label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-[6px] cursor-pointer',
        'bg-card border border-border transition-colors duration-150 hover:bg-card-2',
        copied ? 'text-success' : 'text-muted',
        className,
      )}
    >
      {copied ? <CheckIcon size={12} strokeWidth={2.5} /> : <CopyIcon size={12} strokeWidth={2} />}
    </button>
  );
}
