import { useState } from 'react';
import type { AgentDto } from '../../../api/models';
import { CopyIcon, CheckIcon, GitCompareIcon } from '../../../components/icons';
import { useAgentVersions } from '../hooks/useAgentVersions';
import { Widget } from './Widget';
import { SystemPromptDiffDialog } from './SystemPromptDiffDialog';

interface Props {
  agent: AgentDto;
  className?: string;
}

const CLIP_LINES = 8;

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

export function SystemPromptWidget({ agent, className }: Props) {
  const trimmed = agent.systemMessage ?? '';
  const isEmpty = trimmed.trim().length === 0;
  const lineCount = isEmpty ? 0 : trimmed.split('\n').length;
  const wordCount = countWords(trimmed);

  const { versions, latestVersion } = useAgentVersions(agent.id);
  const previous = versions
    .filter(v => v.versionNumber < latestVersion)
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];

  const [diffOpen, setDiffOpen] = useState(false);

  const meta = isEmpty ? null : (
    <span className="text-body-sm text-muted">
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
      <CopyButton value={trimmed} disabled={isEmpty} />
    </div>
  );

  const expandContent = isEmpty ? (
    <div className="text-muted italic text-body">(no system prompt)</div>
  ) : (
    <div className="font-mono text-body leading-relaxed text-primary whitespace-pre-wrap rounded-md p-4 max-h-[60vh] overflow-y-auto bg-surface">
      {trimmed}
    </div>
  );

  return (
    <Widget
      title="System Prompt"
      right={right}
      expandTitle="System Prompt"
      expandContent={expandContent}
      expandMaxWidth={820}
      className={className}
      bodyClassName="p-0"
    >
      {isEmpty ? (
        <div data-testid="agent-system-prompt" className="px-4 py-5 text-muted italic text-body">(no system prompt)</div>
      ) : (
        <div
          data-testid="agent-system-prompt"
          className="font-mono text-body leading-[1.65] text-primary whitespace-pre-wrap px-4 py-3.5 overflow-hidden"
          style={{
            maxHeight: `${CLIP_LINES * 1.65}em`,
            maskImage: lineCount > CLIP_LINES ? 'linear-gradient(to bottom, black 70%, transparent 100%)' : undefined,
            WebkitMaskImage: lineCount > CLIP_LINES ? 'linear-gradient(to bottom, black 70%, transparent 100%)' : undefined,
          }}
        >
          {trimmed}
        </div>
      )}

      {diffOpen && previous && (
        <SystemPromptDiffDialog
          previousLabel={`v${previous.versionNumber}`}
          currentLabel={`v${latestVersion}`}
          previous={previous.systemMessage}
          current={trimmed}
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
