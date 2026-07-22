import { Trans, useLingui } from '@lingui/react/macro';
import type { ToolSpecDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { Widget } from './Widget';
import { ToolInspector } from './ToolInspector';

interface Props {
  tools: ToolSpecDto[];
  highlightTool?: string | null;
  className?: string;
}

export function ToolsWidget({ tools, highlightTool, className }: Props) {
  const { t } = useLingui();
  if (tools.length === 0) {
    return (
      <Widget title={t`Tools`} className={className}>
        <div className="text-body text-muted italic"><Trans>No tools defined</Trans></div>
      </Widget>
    );
  }

  return (
    <Widget
      title={t`Tools`}
      right={
        <span className="px-1.5 py-px rounded-none text-body-sm font-semibold bg-teal/15 text-teal">
          {tools.length}
        </span>
      }
      className={className}
      bodyClassName={cn('p-0')}
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
