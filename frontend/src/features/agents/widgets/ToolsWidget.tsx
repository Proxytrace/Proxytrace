import { useEffect, useState } from 'react';
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
  string: '#93c5fd', integer: '#fbbf24', number: '#fbbf24',
  boolean: '#f472b6', enum: '#6ee7b7', object: '#f9a8d4', array: '#86efac',
};

const TOOL_ARG_COLUMNS: DataColumn<ToolArgumentDto>[] = [
  {
    key: 'name', label: 'Name', width: '1.2fr',
    render: p => <span className="font-mono text-[12px] font-semibold" style={{ color: '#93c5fd' }}>{p.name}</span>,
  },
  {
    key: 'type', label: 'Type', width: '0.8fr',
    render: p => <ColoredBadge color={TYPE_COLORS[p.type] ?? '#888'} label={p.type} shape="rounded" />,
  },
  {
    key: 'req', label: 'Req', width: '0.4fr',
    render: p => <span className={`text-[12px] font-bold ${p.isRequired ? 'text-danger' : 'text-muted'}`}>{p.isRequired ? '✓' : '—'}</span>,
  },
  {
    key: 'desc', label: 'Description', width: '2.5fr',
    render: p => <span className="text-[12px] text-secondary leading-[1.55]">{p.description ?? '—'}</span>,
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
        <span className="font-mono text-[14px] font-bold" style={{ color: '#6ee7b7' }}>{tool.name}</span>
        <span className="font-mono text-[11px] text-muted">{requiredParams(tool)}</span>
      </div>
      {tool.description && (
        <div
          className="text-[12.5px] text-secondary leading-relaxed px-3 py-2 rounded-lg"
          style={{ background: 'rgba(16,185,129,0.05)', borderLeft: '2px solid rgba(16,185,129,0.3)' }}
        >
          {tool.description}
        </div>
      )}
      {tool.arguments.length > 0 ? (
        <>
          <div className="text-[10px] font-semibold text-muted tracking-[0.08em] uppercase">Parameters</div>
          <div className="overflow-hidden rounded-lg" style={{ background: 'rgba(0,0,0,0.22)' }}>
            <DataTable columns={TOOL_ARG_COLUMNS} rows={tool.arguments} rowKey={p => p.name} />
          </div>
          {tool.arguments.some(a => a.enumValues?.length) && (
            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-semibold text-muted tracking-[0.08em] uppercase">Enum values</div>
              <div className="flex gap-1 flex-wrap">
                {tool.arguments
                  .filter(a => a.enumValues?.length)
                  .flatMap(a => (a.enumValues ?? []).map(v => (
                    <span
                      key={`${a.name}-${v}`}
                      className="font-mono text-[10px] px-[6px] py-[2px] rounded-[4px]"
                      style={{ background: 'rgba(110,231,183,0.1)', color: '#6ee7b7' }}
                    >
                      {a.name}={v}
                    </span>
                  )))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-[12px] text-muted italic">No parameters</div>
      )}
    </div>
  );
}

export function ToolsWidget({ tools, highlightTool, className }: Props) {
  const [openTool, setOpenTool] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightTool) return;
    if (tools.some(t => t.name === highlightTool)) {
      setOpenTool(highlightTool);
    }
  }, [highlightTool, tools]);

  if (tools.length === 0) {
    return (
      <Widget title="Tools" className={className}>
        <div className="text-[12px] text-muted italic">No tools defined</div>
      </Widget>
    );
  }

  const active = tools.find(t => t.name === openTool) ?? null;

  return (
    <Widget
      title="Tools"
      right={
        <span
          className="px-[7px] py-[1px] rounded-full text-[10.5px] font-semibold"
          style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}
        >
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
            className={`flex items-center gap-2 px-4 py-[10px] text-left cursor-pointer hover:bg-[rgba(16,185,129,0.04)] transition-colors duration-100 ${ti === tools.length - 1 ? '' : 'border-b border-hairline'}`}
          >
            <span className="font-mono text-[13px] font-bold" style={{ color: '#6ee7b7' }}>{tool.name}</span>
            <span className="font-mono text-[11px] text-muted">{requiredParams(tool)}</span>
            {tool.description && (
              <span className="text-[11px] text-muted truncate flex-1">{tool.description}</span>
            )}
            <span
              className="ml-auto shrink-0 px-[6px] py-[1px] rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(110,231,183,0.1)', color: '#6ee7b7' }}
            >
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
