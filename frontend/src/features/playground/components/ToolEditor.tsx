import { useState } from 'react';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import { ChevronDownIcon, TrashIcon } from '../../../components/icons';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { IconButton } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import type { PlaygroundToolOverride } from '../state/types';

interface Props {
  tools: PlaygroundToolOverride[];
  onChange: (next: PlaygroundToolOverride[]) => void;
}

// JSON-schema type → tinted pill classes (semantic tokens; see BEST_PRACTICES §5.1).
const TYPE_CLASSES: Record<string, string> = {
  string: 'bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] text-teal border-[color-mix(in_srgb,var(--teal)_28%,transparent)]',
  number: 'bg-warn-subtle text-warn border-[color-mix(in_srgb,var(--warn)_28%,transparent)]',
  integer: 'bg-warn-subtle text-warn border-[color-mix(in_srgb,var(--warn)_28%,transparent)]',
  boolean: 'bg-accent-subtle text-accent-hover border-[color-mix(in_srgb,var(--accent-primary)_28%,transparent)]',
  array: 'bg-success-subtle text-success border-[color-mix(in_srgb,var(--success)_28%,transparent)]',
  object: 'bg-[var(--border-subtle)] text-secondary border-border',
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
      className="rounded-[10px] overflow-hidden bg-[rgba(0,0,0,0.18)] border border-border"
    >
      <div className="flex items-center gap-[6px] px-[10px] py-[8px]">
        <RowButton
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-[6px] flex-1"
          aria-expanded={open}
        >
          <ChevronDownIcon
            size={11}
            strokeWidth={2.4}
            className={`text-muted transition-transform ${open ? '' : '-rotate-90'}`}
          />
          <span className="mono text-[12px] font-semibold text-success">
            {tool.name || t`(unnamed)`}
          </span>
          <span
            className="text-[10px] mono px-[6px] py-[1px] rounded-full bg-[rgba(255,255,255,0.04)] text-muted"
          >
            <Plural value={argCount} one="# arg" other="# args" />
          </span>
        </RowButton>
        <IconButton danger onClick={onRemove} title={t`Remove tool`} aria-label={t`Remove tool`}>
          <TrashIcon size={11} />
        </IconButton>
      </div>
      {!open && tool.description && (
        <div className="px-[10px] pb-[8px] text-[11px] text-muted leading-[1.45] line-clamp-2">{tool.description}</div>
      )}
      {open && (
        <div className="px-[10px] pb-[10px] flex flex-col gap-[8px]">
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
            <div className="flex flex-col gap-[6px]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted"><Trans>Arguments</Trans></div>
              {tool.arguments.map((arg, ai) => {
                return (
                  <div
                    key={ai}
                    className="rounded-[8px] p-[8px] flex flex-col gap-[6px] bg-[rgba(255,255,255,0.02)] border border-border"
                  >
                    <div className="flex items-center gap-[6px] flex-wrap">
                      <span className="mono text-[12px] font-semibold text-primary">{arg.name}</span>
                      {arg.isRequired && (
                        <span className="text-danger text-[12px]" title={t`Required`} aria-label={t`required`}>*</span>
                      )}
                      <span className={`mono text-[10px] px-[6px] py-[1px] rounded-full border ${typeClass(arg.type)}`}>
                        {arg.type}
                      </span>
                    </div>
                    <Textarea
                      className="text-[12px]"
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
        className="rounded-[10px] border border-dashed border-border text-[11.5px] text-muted px-[10px] py-[12px] text-center"
      >
        <Trans>Agent has no tools.</Trans>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[8px]">
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
