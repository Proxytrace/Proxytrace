import { useMemo, useState } from 'react';
import { Highlight, type PrismTheme } from 'prism-react-renderer';
import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../lib/cn';
import { CopyIcon, CheckIcon } from '../icons';

/* eslint-disable lingui/no-unlocalized-strings -- Prism token types + CSS values, not UI copy */
const proxytraceJsonTheme: PrismTheme = {
  plain: {
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
  },
  styles: [
    { types: ['string'],                style: { color: 'var(--success)' } },
    { types: ['number'],                style: { color: 'var(--warn)' } },
    { types: ['boolean'],               style: { color: 'var(--danger)' } },
    { types: ['null', 'keyword'],       style: { color: 'var(--danger)' } },
    { types: ['property', 'tag'],       style: { color: 'var(--teal)' } },
    { types: ['punctuation', 'operator'], style: { color: 'var(--text-muted)' } },
    { types: ['comment'],               style: { color: 'var(--text-muted)', fontStyle: 'italic' } },
  ],
};
/* eslint-enable lingui/no-unlocalized-strings */

interface Props {
  value: unknown;
  className?: string;
  maxHeight?: number | string;
  hideCopy?: boolean;
  transparent?: boolean;
}

function format(value: unknown): string {
  // eslint-disable-next-line lingui/no-unlocalized-strings -- JSON literal value, not UI copy
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export function JsonBlock({ value, className, maxHeight, hideCopy, transparent }: Props) {
  const { t } = useLingui();
  const text = useMemo(() => format(value), [value]);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* ignore */ });
  }

  const containerClass = cn('relative rounded-[10px] overflow-auto px-4 py-[14px]', transparent ? '' : 'bg-[rgba(0,0,0,0.28)]', className);
  const containerStyle = maxHeight != null ? { maxHeight } : undefined;

  return (
    <div role="region" aria-label={t`JSON`} className={containerClass} style={containerStyle}>
      <Highlight code={text} language="json" theme={proxytraceJsonTheme}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="m-0 font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap break-words">
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line });
              return (
                <div key={i} {...lineProps}>
                  {line.map((token, j) => {
                    const tokenProps = getTokenProps({ token });
                    return <span key={j} {...tokenProps} />;
                  })}
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>

      {!hideCopy && (
        <button
          type="button"
          onClick={copy}
          aria-label={t`Copy JSON`}
          title={t`Copy JSON`}
          className={`absolute top-2 right-2 inline-flex items-center gap-[4px] text-[10.5px] font-medium px-[7px] py-[3px] rounded-[6px] cursor-pointer transition-colors duration-150 bg-card-2 hover:bg-[rgba(255,255,255,0.06)] ${copied ? 'text-success' : 'text-muted'}`}
        >
          {copied ? <CheckIcon size={11} strokeWidth={2.5} /> : <CopyIcon size={11} strokeWidth={2} />}
          <span aria-live="polite">{copied ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}</span>
        </button>
      )}
    </div>
  );
}
