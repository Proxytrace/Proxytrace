import type { ToolSpecDto } from '../../../api/models';
import { Widget } from './Widget';
import { ToolInspector } from './ToolInspector';

interface Props {
  tools: ToolSpecDto[];
  highlightTool?: string | null;
  className?: string;
}

export function ToolsWidget({ tools, highlightTool, className }: Props) {
  if (tools.length === 0) {
    return (
      <Widget title="Tools" className={className}>
        <div className="text-body text-muted italic">No tools defined</div>
      </Widget>
    );
  }

  return (
    <Widget
      title="Tools"
      right={
        <span className="px-1.5 py-px rounded-full text-body-sm font-semibold bg-teal/15 text-teal">
          {tools.length}
        </span>
      }
      className={className}
      bodyClassName="p-0"
    >
      <div className="flex flex-col" data-testid="tools-list">
        {tools.map((tool, ti) => (
          <ToolInspector
            key={tool.name}
            tool={tool}
            defaultOpen={highlightTool === tool.name}
            last={ti === tools.length - 1}
          />
        ))}
      </div>
    </Widget>
  );
}
