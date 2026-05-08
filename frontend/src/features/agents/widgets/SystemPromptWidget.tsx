import { useState } from 'react';
import { CopyIcon, CheckIcon } from '../../../components/icons';
import { Widget } from './Widget';

interface Props {
  systemMessage: string;
  className?: string;
}

const CLIP_LINES = 8;

export function SystemPromptWidget({ systemMessage, className }: Props) {
  const trimmed = systemMessage ?? '';
  const isEmpty = trimmed.trim().length === 0;
  const lineCount = isEmpty ? 0 : trimmed.split('\n').length;

  const expandContent = isEmpty ? (
    <div className="text-muted italic text-[12.5px]">(no system prompt)</div>
  ) : (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CopyButton value={trimmed} />
      </div>
      <div
        className="font-mono text-[12px] leading-[1.7] text-primary whitespace-pre-wrap rounded-lg p-4 max-h-[60vh] overflow-y-auto"
        style={{ background: 'var(--bg-card-2)' }}
      >
        {trimmed}
      </div>
      <div className="text-[10.5px] text-muted text-right">{lineCount} line{lineCount !== 1 ? 's' : ''}</div>
    </div>
  );

  return (
    <Widget
      title="System Prompt"
      right={!isEmpty && <span className="text-[10.5px] text-muted">{lineCount} line{lineCount !== 1 ? 's' : ''}</span>}
      expandTitle="System Prompt"
      expandContent={expandContent}
      expandMaxWidth={820}
      className={className}
      bodyClassName="p-0"
    >
      {isEmpty ? (
        <div className="px-4 py-5 text-muted italic text-[12px]">(no system prompt)</div>
      ) : (
        <div className="relative">
          <div
            className="font-mono text-[11.5px] leading-[1.7] text-primary whitespace-pre-wrap px-4 py-[14px] overflow-hidden"
            style={{
              maxHeight: `${CLIP_LINES * 1.7}em`,
              maskImage: lineCount > CLIP_LINES
                ? 'linear-gradient(to bottom, black 70%, transparent 100%)'
                : undefined,
              WebkitMaskImage: lineCount > CLIP_LINES
                ? 'linear-gradient(to bottom, black 70%, transparent 100%)'
                : undefined,
            }}
          >
            {trimmed}
          </div>
        </div>
      )}
    </Widget>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-[5px] px-[10px] py-[5px] rounded-lg text-[11px] font-medium bg-card-2 text-secondary hover:text-primary cursor-pointer transition-colors duration-150"
    >
      {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
