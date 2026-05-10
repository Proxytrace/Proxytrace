import { TrashIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/FormField';
import type { PlaygroundToolOverride } from '../state/types';

interface Props {
  tools: PlaygroundToolOverride[];
  onChange: (next: PlaygroundToolOverride[]) => void;
}

export function ToolEditor({ tools, onChange }: Props) {
  const updateTool = (idx: number, patch: Partial<PlaygroundToolOverride>) => {
    const next = tools.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const updateArg = (toolIdx: number, argIdx: number, patch: Partial<PlaygroundToolOverride['arguments'][number]>) => {
    const tool = tools[toolIdx];
    const args = tool.arguments.slice();
    args[argIdx] = { ...args[argIdx], ...patch };
    updateTool(toolIdx, { arguments: args });
  };

  const removeTool = (idx: number) => {
    const next = tools.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  if (tools.length === 0) {
    return <div className="text-[11.5px] text-muted italic">Agent has no tools.</div>;
  }

  return (
    <div className="flex flex-col gap-[10px]">
      {tools.map((tool, i) => (
        <details key={i} className="rounded-[10px] border border-border bg-card-2">
          <summary className="px-[10px] py-[8px] cursor-pointer flex items-center gap-2 text-[12.5px] font-mono">
            <span className="font-semibold text-emerald-300">{tool.name || '(unnamed)'}</span>
            <span className="text-muted text-[10.5px]">· {tool.arguments.length} arg{tool.arguments.length === 1 ? '' : 's'}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); removeTool(i); }}
              className="ml-auto btn-icon"
              title="Remove tool"
            >
              <TrashIcon size={12} />
            </button>
          </summary>
          <div className="px-[10px] pb-[10px] flex flex-col gap-[8px]">
            <input
              className={formInputCls}
              value={tool.name}
              placeholder="Name"
              onChange={e => updateTool(i, { name: e.target.value })}
            />
            <textarea
              className={`${formInputCls} resize-y`}
              rows={2}
              value={tool.description}
              placeholder="Description"
              onChange={e => updateTool(i, { description: e.target.value })}
            />
            {tool.arguments.length > 0 && (
              <div className="flex flex-col gap-[6px] mt-[4px]">
                <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.05em]">Parameters</div>
                {tool.arguments.map((arg, ai) => (
                  <div key={ai} className="flex flex-col gap-[4px] p-[8px] rounded-[8px] bg-[rgba(0,0,0,0.18)] border border-border">
                    <div className="flex items-center gap-2 text-[11.5px] font-mono">
                      <span className="font-semibold">{arg.name}</span>
                      <span className="text-muted">· {arg.type}{arg.isRequired ? ' · required' : ''}</span>
                    </div>
                    <textarea
                      className={`${formInputCls} resize-y`}
                      rows={2}
                      value={arg.description}
                      placeholder="Parameter description"
                      onChange={e => updateArg(i, ai, { description: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
