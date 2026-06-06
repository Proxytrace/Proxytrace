import { useState } from 'react';
import { CopyIcon, CheckIcon, GitCompareIcon, ChevronDownIcon } from '../../../components/icons';
import { useAgentVersions } from '../hooks/useAgentVersions';
import { Widget } from './Widget';
import { SystemPromptDiffDialog } from './SystemPromptDiffDialog';

interface Props {
  agentId: string;
  /** System prompt of the version currently being viewed. */
  systemMessage: string;
  /** Version number currently being viewed. */
  activeVersion: number;
  isLatest: boolean;
  className?: string;
}

const CLIP_LINES = 8;

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

export function SystemPromptWidget({ agentId, systemMessage, activeVersion, isLatest, className }: Props) {
  const trimmed = systemMessage ?? '';
  const isEmpty = trimmed.trim().length === 0;
  const lineCount = isEmpty ? 0 : trimmed.split('\n').length;
  const wordCount = countWords(trimmed);

  const { versions } = useAgentVersions(agentId);
  // Default diff base: the version immediately preceding the one being viewed.
  const previous = versions
    .filter(v => v.versionNumber < activeVersion)
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];

  const [diffOpen, setDiffOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const clipped = lineCount > CLIP_LINES;

  const meta = isEmpty ? null : (
    <span className="text-body-sm text-muted">
      {!isLatest && <span className="font-mono font-semibold text-secondary">v{activeVersion} · </span>}
      {wordCount} word{wordCount !== 1 ? 's' : ''} · {lineCount} line{lineCount !== 1 ? 's' : ''}
    </span>
  );

  const right = (
    <div className="flex items-center gap-2">
      {meta}
      {previous && !isEmpty && (
        <button
          type="button"
          onClick={() => setDiffOpen(true)}
          data-testid="system-prompt-diff-btn"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-body-sm font-medium bg-card-2 text-secondary hover:text-primary cursor-pointer transition-colors duration-150"
        >
          <GitCompareIcon size={12} />
          Diff vs v{previous.versionNumber}
        </button>
      )}
      {clipped && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          data-testid="system-prompt-expand-btn"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-body-sm font-medium bg-card-2 text-secondary hover:text-primary cursor-pointer transition-colors duration-150"
        >
          <ChevronDownIcon size={12} className={`transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
      <CopyButton value={trimmed} disabled={isEmpty} />
    </div>
  );

  return (
    <Widget
      title="System Prompt"
      right={right}
      className={className}
      bodyClassName="p-0"
    >
      {isEmpty ? (
        <div data-testid="agent-system-prompt" className="px-4 py-5 text-muted italic text-body">(no system prompt)</div>
      ) : (
        <div
          data-testid="agent-system-prompt"
          className={`font-mono text-body leading-[1.65] text-primary whitespace-pre-wrap px-4 py-3.5 ${
            expanded ? 'max-h-[60vh] overflow-y-auto' : 'overflow-hidden'
          }`}
          style={
            expanded
              ? undefined
              : {
                  maxHeight: `${CLIP_LINES * 1.65}em`,
                  maskImage: clipped ? 'linear-gradient(to bottom, black 70%, transparent 100%)' : undefined,
                  WebkitMaskImage: clipped ? 'linear-gradient(to bottom, black 70%, transparent 100%)' : undefined,
                }
          }
        >
          {trimmed}
        </div>
      )}

      {diffOpen && previous && (
        <SystemPromptDiffDialog
          versions={versions}
          initialBase={previous.versionNumber}
          initialCompare={activeVersion}
          onClose={() => setDiffOpen(false)}
        />
      )}
    </Widget>
  );
}

function CopyButton({ value, disabled }: { value: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label="Copy system prompt"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-body-sm font-medium bg-card-2 text-secondary hover:text-primary cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
