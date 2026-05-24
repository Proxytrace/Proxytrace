import { useState } from 'react';
import type { ToolSpecDto, ToolArgumentDto } from '../../../api/models';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataColumn } from '../../../components/ui/DataTable';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { Modal } from '../../../components/overlays/Modal';
import { ChevronRightIcon } from '../../../components/icons';
import { Widget } from './Widget';

interface Props {
  tools: ToolSpecDto[];
  highlightTool?: string | null;
  className?: string;
}

// Syntax-highlight palette for JSON-Schema type tags (intentional, not brand colors).
const TYPE_COLORS: Record<string, string> = {
  string: 'var(--teal)', integer: 'var(--warn)', number: 'var(--warn)',
  boolean: 'var(--danger)', enum: 'var(--success)', object: 'var(--accent-hover)', array: 'var(--success)',
};

const TOOL_ARG_COLUMNS: DataColumn<ToolArgumentDto>[] = [
  {
    key: 'name', label: 'Name', width: '1.2fr',
    render: p => <span className="font-mono text-body font-semibold" style={{ color: TYPE_COLORS.string }}>{p.name}</span>,
  },
  {
    key: 'type', label: 'Type', width: '0.8fr',
    render: p => <ColoredBadge color={TYPE_COLORS[p.type] ?? 'var(--text-muted)'} label={p.type} shape="rounded" />,
  },
  {
    key: 'req', label: 'Req', width: '0.4fr',
    render: p => <span className={`text-body font-semibold ${p.isRequired ? 'text-danger' : 'text-muted'}`}>{p.isRequired ? '✓' : '—'}</span>,
  },
  {
    key: 'desc', label: 'Description', width: '2.5fr',
    render: p => <span className="text-body text-secondary leading-snug">{p.description ?? '—'}</span>,
  },
];

function requiredParams(tool: ToolSpecDto) {
  const req = tool.arguments.filter(a => a.isRequired).map(a => a.name);
  return req.length ? `(${req.join(', ')})` : '()';
}

function ToolDetailBody({ tool }: { tool: ToolSpecDto }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-h2 font-semibold text-teal">{tool.name}</span>
        <span className="font-mono text-body-sm text-muted">{requiredParams(tool)}</span>
      </div>
      {tool.description && (
        <div className="text-body text-secondary leading-relaxed px-3 py-2 rounded-md bg-card-2 border-l-2 border-teal/40">
          {tool.description}
        </div>
      )}
      {tool.arguments.length > 0 ? (
        <>
          <div className="text-caption font-semibold text-muted tracking-[0.08em] uppercase">Parameters</div>
          <div className="overflow-hidden rounded-md bg-surface">
            <DataTable columns={TOOL_ARG_COLUMNS} rows={tool.arguments} rowKey={p => p.name} />
          </div>
          {tool.arguments.some(a => a.enumValues?.length) && (
            <div className="flex flex-col gap-2">
              <div className="text-caption font-semibold text-muted tracking-[0.08em] uppercase">Enum values</div>
              <div className="flex gap-1 flex-wrap">
                {tool.arguments
                  .filter(a => a.enumValues?.length)
                  .flatMap(a => (a.enumValues ?? []).map(v => (
                    <span
                      key={`${a.name}-${v}`}
                      className="font-mono text-caption px-1.5 py-0.5 rounded-sm bg-teal/10 text-teal"
                    >
                      {a.name}={v}
                    </span>
                  )))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-body text-muted italic">No parameters</div>
      )}
    </div>
  );
}

export function ToolsWidget({ tools, highlightTool, className }: Props) {
  const [openToolState, setOpenTool] = useState<string | null>(null);

  const openTool = openToolState
    ?? (highlightTool && tools.some(t => t.name === highlightTool) ? highlightTool : null);

  if (tools.length === 0) {
    return (
      <Widget title="Tools" className={className}>
        <div className="text-body text-muted italic">No tools defined</div>
      </Widget>
    );
  }

  const active = tools.find(t => t.name === openTool) ?? null;

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
      <div className="flex flex-col">
        {tools.map((tool, ti) => (
          <button
            key={tool.name}
            onClick={() => setOpenTool(tool.name)}
            className={`flex items-center gap-2 px-4 py-2.5 text-left cursor-pointer hover:bg-[var(--bg-wash-hover)] transition-colors duration-100 ${ti === tools.length - 1 ? '' : 'border-b border-hairline'}`}
          >
            <span className="font-mono text-title font-semibold text-teal">{tool.name}</span>
            <span className="font-mono text-body-sm text-muted">{requiredParams(tool)}</span>
            {tool.description && (
              <span className="text-body-sm text-muted truncate flex-1">{tool.description}</span>
            )}
            <span className="ml-auto shrink-0 px-1.5 py-px rounded-full text-caption font-semibold bg-teal/10 text-teal">
              {tool.arguments.length} arg{tool.arguments.length !== 1 ? 's' : ''}
            </span>
            <ChevronRightIcon size={12} className="text-muted" />
          </button>
        ))}
      </div>

      {active && (
        <Modal title={`Tool · ${active.name}`} onClose={() => setOpenTool(null)} maxWidth={720}>
          <ToolDetailBody tool={active} />
        </Modal>
      )}
    </Widget>
  );
}
