import { useState } from 'react';
import { ChevronDownIcon, TrashIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/classes';
import type { PlaygroundToolOverride } from '../state/types';

interface Props {
  tools: PlaygroundToolOverride[];
  onChange: (next: PlaygroundToolOverride[]) => void;
}

const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  string: {
    bg: 'color-mix(in srgb, var(--teal) 12%, transparent)',
    color: 'var(--teal)',
    border: 'color-mix(in srgb, var(--teal) 28%, transparent)',
  },
  number: {
    bg: 'var(--warn-subtle)',
    color: 'var(--warn)',
    border: 'color-mix(in srgb, var(--warn) 28%, transparent)',
  },
  integer: {
    bg: 'var(--warn-subtle)',
    color: 'var(--warn)',
    border: 'color-mix(in srgb, var(--warn) 28%, transparent)',
  },
  boolean: {
    bg: 'var(--accent-subtle)',
    color: 'var(--accent-hover)',
    border: 'color-mix(in srgb, var(--accent-primary) 28%, transparent)',
  },
  array: {
    bg: 'var(--success-subtle)',
    color: 'var(--success)',
    border: 'color-mix(in srgb, var(--success) 28%, transparent)',
  },
  object: {
    bg: 'var(--border-subtle)',
    color: 'var(--text-secondary)',
    border: 'var(--border-color)',
  },
};

function typeColor(type: string) {
  const t = type.toLowerCase();
  return TYPE_COLORS[t] ?? TYPE_COLORS.object;
}

interface ToolCardProps {
  tool: PlaygroundToolOverride;
  index: number;
  onUpdate: (patch: Partial<PlaygroundToolOverride>) => void;
  onRemove: () => void;
}

function ToolCard({ tool, onUpdate, onRemove }: ToolCardProps) {
  const [open, setOpen] = useState(false);
  const argCount = tool.arguments.length;

  const updateArg = (argIdx: number, patch: Partial<PlaygroundToolOverride['arguments'][number]>) => {
    const args = tool.arguments.slice();
    args[argIdx] = { ...args[argIdx], ...patch };
    onUpdate({ arguments: args });
  };

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-[6px] px-[10px] py-[8px]">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-[6px] flex-1 cursor-pointer text-left"
          aria-expanded={open}
        >
          <ChevronDownIcon
            size={11}
            strokeWidth={2.4}
            className={`text-muted transition-transform ${open ? '' : '-rotate-90'}`}
          />
          <span className="mono text-[12px] font-semibold text-success">
            {tool.name || '(unnamed)'}
          </span>
          <span
            className="text-[10px] mono px-[6px] py-[1px] rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}
          >
            {argCount} arg{argCount === 1 ? '' : 's'}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="btn-icon btn-icon-danger"
          title="Remove tool"
          aria-label="Remove tool"
        >
          <TrashIcon size={11} />
        </button>
      </div>
      {!open && tool.description && (
        <div className="px-[10px] pb-[8px] text-[11px] text-muted leading-[1.45] line-clamp-2">{tool.description}</div>
      )}
      {open && (
        <div className="px-[10px] pb-[10px] flex flex-col gap-[8px]">
          <input
            className={formInputCls}
            value={tool.name}
            placeholder="Name"
            onChange={e => onUpdate({ name: e.target.value })}
          />
          <textarea
            className={`${formInputCls} resize-y`}
            rows={2}
            value={tool.description}
            placeholder="Description"
            onChange={e => onUpdate({ description: e.target.value })}
          />
          {argCount > 0 && (
            <div className="flex flex-col gap-[6px]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Arguments</div>
              {tool.arguments.map((arg, ai) => {
                const tc = typeColor(arg.type);
                return (
                  <div
                    key={ai}
                    className="rounded-[8px] p-[8px] flex flex-col gap-[6px]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}
                  >
                    <div className="flex items-center gap-[6px] flex-wrap">
                      <span className="mono text-[12px] font-semibold text-primary">{arg.name}</span>
                      {arg.isRequired && (
                        <span className="text-danger text-[12px]" title="Required" aria-label="required">*</span>
                      )}
                      <span
                        className="mono text-[10px] px-[6px] py-[1px] rounded-full"
                        style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}
                      >
                        {arg.type}
                      </span>
                    </div>
                    <textarea
                      className={`${formInputCls} resize-y text-[12px]`}
                      rows={2}
                      value={arg.description}
                      placeholder="Parameter description"
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
        className="rounded-[10px] border border-dashed text-[11.5px] text-muted px-[10px] py-[12px] text-center"
        style={{ borderColor: 'var(--border-color)' }}
      >
        Agent has no tools.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {tools.map((tool, i) => (
        <ToolCard
          key={i}
          tool={tool}
          index={i}
          onUpdate={patch => updateTool(i, patch)}
          onRemove={() => removeTool(i)}
        />
      ))}
    </div>
  );
}
