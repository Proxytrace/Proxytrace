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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {heading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          <span>{heading}</span>
          <button
            onClick={copy}
            style={{
              fontSize: '11px', fontWeight: 500, padding: '2px 8px',
              borderRadius: '6px', border: '1px solid var(--border-color)',
              color: copied ? 'var(--success)' : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          margin: 0,
          padding: '12px 14px',
          background: 'var(--bg-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          fontSize: '12px',
          lineHeight: '1.6',
          fontFamily: mono ? "'JetBrains Mono', 'Fira Code', monospace" : 'inherit',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowX: 'auto',
          color: 'var(--text-primary)',
        }}>
          {language && (
            <span style={{
              position: 'absolute', top: '8px', right: '10px',
              fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'inherit',
            }}>
              {language}
            </span>
          )}
          {displayed}
        </pre>
        {!heading && (
          <button
            onClick={copy}
            style={{
              position: 'absolute', top: '8px', right: '8px',
              fontSize: '11px', fontWeight: 500, padding: '2px 7px',
              borderRadius: '5px', border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: copied ? 'var(--success)' : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      {isTruncated && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            alignSelf: 'flex-start', fontSize: '12px', fontWeight: 500,
            color: 'var(--accent-primary)', padding: '2px 0',
          }}
        >
          {expanded ? 'Show less' : `Show ${lines.length - maxLines} more lines`}
        </button>
      )}
    </div>
  );
}
