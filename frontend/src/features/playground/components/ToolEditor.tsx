import { useState } from 'react';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import { ChevronDownIcon, TrashIcon } from '../../../components/icons';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { IconButton } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import { cn } from '../../../lib/cn';
import type { PlaygroundToolOverride } from '../state/types';

interface Props {
  tools: PlaygroundToolOverride[];
  onChange: (next: PlaygroundToolOverride[]) => void;
}

// JSON-schema type → tinted tag classes (semantic tokens; see BEST_PRACTICES §5.1).
const TYPE_CLASSES: Record<string, string> = {
  string: cn('bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] text-teal border-[color-mix(in_srgb,var(--teal)_28%,transparent)]'),
  number: cn('bg-warn-subtle text-warn border-[color-mix(in_srgb,var(--warn)_28%,transparent)]'),
  integer: cn('bg-warn-subtle text-warn border-[color-mix(in_srgb,var(--warn)_28%,transparent)]'),
  boolean: cn('bg-accent-subtle text-accent-hover border-[color-mix(in_srgb,var(--accent-primary)_28%,transparent)]'),
  array: cn('bg-success-subtle text-success border-[color-mix(in_srgb,var(--success)_28%,transparent)]'),
  object: cn('bg-[var(--border-subtle)] text-secondary border-border'),
};

function typeClass(type: string): string {
  return TYPE_CLASSES[type.toLowerCase()] ?? TYPE_CLASSES.object;
}

interface ToolCardProps {
  tool: PlaygroundToolOverride;
  onUpdate: (patch: Partial<PlaygroundToolOverride>) => void;
  onRemove: () => void;
}

function ToolCard({ tool, onUpdate, onRemove }: ToolCardProps) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const argCount = tool.arguments.length;

  const updateArg = (argIdx: number, patch: Partial<PlaygroundToolOverride['arguments'][number]>) => {
    const args = tool.arguments.slice();
    args[argIdx] = { ...args[argIdx], ...patch };
    onUpdate({ arguments: args });
  };

  return (
    <div
      className="rounded-md overflow-hidden bg-black/[0.18] border border-border"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <RowButton
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 flex-1 min-w-0"
          aria-expanded={open}
        >
          <ChevronDownIcon
            size={11}
            strokeWidth={2.4}
            className={`shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'}`}
          />
          <span className="mono text-body font-semibold text-success min-w-0 truncate">
            {tool.name || t`(unnamed)`}
          </span>
          <span
            className="text-caption mono px-1.5 py-px rounded-none bg-[var(--bg-wash-hover)] text-muted shrink-0"
          >
            <Plural value={argCount} one="# arg" other="# args" />
          </span>
        </RowButton>
        <IconButton danger onClick={onRemove} title={t`Remove tool`} aria-label={t`Remove tool`}>
          <TrashIcon size={11} />
        </IconButton>
      </div>
      {!open && tool.description && (
        <div className="px-2.5 pb-2 text-body-sm text-muted leading-[1.45] line-clamp-2">{tool.description}</div>
      )}
      {open && (
        <div className="px-2.5 pb-2.5 flex flex-col gap-2">
          <Input
            value={tool.name}
            placeholder={t`Name`}
            onChange={e => onUpdate({ name: e.target.value })}
          />
          <Textarea
            rows={2}
            value={tool.description}
            placeholder={t`Description`}
            onChange={e => onUpdate({ description: e.target.value })}
          />
          {argCount > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-caption font-semibold uppercase tracking-[0.06em] text-muted"><Trans>Arguments</Trans></div>
              {tool.arguments.map((arg, ai) => {
                return (
                  <div
                    key={ai}
                    className="rounded-md p-2 flex flex-col gap-1.5 bg-white/[0.02] border border-border"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="mono text-body font-semibold text-primary">{arg.name}</span>
                      {arg.isRequired && (
                        <span className="text-danger text-body" title={t`Required`} aria-label={t`required`}>*</span>
                      )}
                      <span className={cn('mono text-caption px-1.5 py-px rounded-none border', typeClass(arg.type))}>
                        {arg.type}
                      </span>
                    </div>
                    <Textarea
                      className="text-body"
                      rows={2}
                      value={arg.description}
                      placeholder={t`Parameter description`}
                      onChange={e => updateArg(ai, { description: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolEditor({ tools, onChange }: Props) {
  const updateTool = (idx: number, patch: Partial<PlaygroundToolOverride>) => {
    const next = tools.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeTool = (idx: number) => {
    const next = tools.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  if (tools.length === 0) {
    return (
      <div
        className="rounded-md border border-dashed border-border text-body-sm text-muted px-2.5 py-3 text-center"
      >
        <Trans>Agent has no tools.</Trans>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tools.map((tool, i) => (
        <ToolCard
          key={tool.localId}
          tool={tool}
          onUpdate={patch => updateTool(i, patch)}
          onRemove={() => removeTool(i)}
        />
      ))}
    </div>
  );
}
