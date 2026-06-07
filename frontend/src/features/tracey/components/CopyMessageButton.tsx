import { useEffect, useRef, useState } from 'react';
import { CheckIcon, CopyIcon } from '../../../components/icons';
import { IconButton } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/Toast';

/** Copies the assistant response text to the clipboard, briefly confirming with a check icon. */
export function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  // The confirmation timer is an external resource; clear it if the message unmounts mid-confirm.
  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('Could not copy to clipboard.', 'error');
    }
  };

  return (
    <IconButton
      size="sm"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy response'}
      title={copied ? 'Copied' : 'Copy response'}
      data-testid="tracey-copy-btn"
    >
      {copied ? <CheckIcon size={14} className="text-success" /> : <CopyIcon size={14} />}
    </IconButton>
  );
}
