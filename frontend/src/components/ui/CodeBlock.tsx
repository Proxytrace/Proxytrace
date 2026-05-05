import { useState } from 'react';

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
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.06em] uppercase text-muted">
          <span>{heading}</span>
          <button
            onClick={copy}
            className={`text-[11px] font-medium px-2 py-[2px] rounded-md border border-border transition-colors ${copied ? 'text-success' : 'text-muted'}`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <div className="relative">
        <pre
          className={`m-0 px-3.5 py-3 bg-surface border border-border rounded-lg text-xs leading-relaxed whitespace-pre-wrap break-words overflow-x-auto text-primary ${mono ? 'font-mono' : 'font-[inherit]'}`}
        >
          {language && (
            <span className="absolute top-2 right-[10px] text-[10px] text-muted font-[inherit]">
              {language}
            </span>
          )}
          {displayed}
        </pre>
        {!heading && (
          <button
            onClick={copy}
            className={`absolute top-2 right-2 text-[11px] font-medium px-[7px] py-[2px] rounded-[5px] border border-border bg-card transition-colors ${copied ? 'text-success' : 'text-muted'}`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      {isTruncated && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="self-start text-xs font-medium text-accent py-[2px]"
        >
          {expanded ? 'Show less' : `Show ${lines.length - maxLines} more lines`}
        </button>
      )}
    </div>
  );
}
