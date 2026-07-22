import { useState } from 'react';
import { Plural, Trans } from '@lingui/react/macro';

interface CodeBlockProps {
  heading?: string;
  content: string;
  maxLines?: number;
  mono?: boolean;
  language?: string;
}

export function CodeBlock({ heading, content, maxLines = 10, mono = true, language }: CodeBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = content.split('\n');
  const isTruncated = lines.length > maxLines;
  const displayed = expanded || !isTruncated ? content : lines.slice(0, maxLines).join('\n') + '\n…';

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {heading && (
        <div className="flex items-center justify-between text-body-sm font-semibold tracking-[0.06em] uppercase text-secondary">
          <span>{heading}</span>
          <button
            onClick={copy}
            className={`text-body-sm font-medium px-2 py-0.5 rounded-md border border-border transition-colors ${copied ? 'text-success' : 'text-muted'}`}
          >
            {copied ? <Trans>Copied!</Trans> : <Trans>Copy</Trans>}
          </button>
        </div>
      )}
      <div className="relative">
        <pre
          className={`m-0 px-3.5 py-3 bg-surface border border-border rounded-lg text-body-sm leading-relaxed whitespace-pre-wrap break-words overflow-x-auto text-primary ${mono ? 'font-mono' : 'font-[inherit]'}`}
        >
          {language && (
            <span className={`absolute top-2 ${heading ? 'right-[10px]' : 'right-[60px]'} text-caption text-muted font-[inherit]`}>
              {language}
            </span>
          )}
          {displayed}
        </pre>
        {!heading && (
          <button
            onClick={copy}
            className={`absolute top-2 right-2 text-body-sm font-medium px-1.75 py-0.5 rounded-sm border border-border bg-card transition-colors ${copied ? 'text-success' : 'text-muted'}`}
          >
            {copied ? <Trans>Copied!</Trans> : <Trans>Copy</Trans>}
          </button>
        )}
      </div>
      {isTruncated && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="self-start text-body-sm font-medium text-accent py-0.5"
        >
          {expanded
            ? <Trans>Show less</Trans>
            : <Plural value={lines.length - maxLines} one="Show # more line" other="Show # more lines" />}
        </button>
      )}
    </div>
  );
}
