import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { agentsApi } from '../../api/agents';
import { providersApi } from '../../api/providers';
import { QUERY_KEYS } from '../../api/query-keys';
import type { AgentDto, ToolSpecDto, ToolArgumentDto } from '../../api/models';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import { ChevronDownIcon, TrashIcon } from '../../components/icons';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { Collapsible } from '../../components/ui/Collapsible';
import { LIST_PAGE_SIZE } from '../../lib/constants';
import { agentColor } from '../../lib/colors';
import { fmtDate, fmtRelative } from '../../lib/format';
import { ColoredBadge } from '../../components/ui/ColoredBadge';

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

function ToolRow({ tool, last }: { tool: ToolSpecDto; last: boolean }) {
  return (
    <div className={last ? '' : 'border-b border-hairline'}>
      <Collapsible
        headerClassName="gap-[10px] px-4 py-[11px] hover:bg-[rgba(16,185,129,0.04)] transition-[background] duration-100"
        contentClassName="px-4 pb-[14px] pl-[38px]"
        title={
          <>
            <span className="font-mono text-[13px] font-bold" style={{ color: '#6ee7b7' }}>{tool.name}</span>
            <span className="font-mono text-[11px] text-muted">{requiredParams(tool)}</span>
            <span className="ml-auto text-[11px] text-muted truncate max-w-[300px]">{tool.description}</span>
          </>
        }
      >
        {tool.description && (
          <div className="text-[12.5px] text-secondary leading-relaxed mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.05)', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
            {tool.description}
          </div>
        )}
        {tool.arguments.length > 0 && (
          <>
            <div className="text-[10px] font-semibold text-muted tracking-[0.08em] uppercase mb-[6px]">Parameters</div>
            <div className="overflow-hidden rounded-lg" style={{ background: 'rgba(0,0,0,0.22)' }}>
              <DataTable columns={TOOL_ARG_COLUMNS} rows={tool.arguments} rowKey={p => p.name} />
            </div>
            {tool.arguments.some(a => a.enumValues?.length) && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {tool.arguments.filter(a => a.enumValues?.length).flatMap(a => (a.enumValues ?? []).map(v => (
                  <span key={`${a.name}-${v}`} className="font-mono text-[9.5px] px-[5px] py-[1px] rounded-[3px]" style={{ background: 'rgba(110,231,183,0.1)', color: '#6ee7b7' }}>{v}</span>
                )))}
              </div>
            )}
          </>
        )}
      </Collapsible>
    </div>
  );
}

function EndpointSelector({ agent }: { agent: AgentDto }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const { data: endpoints = [] } = useQuery({
    queryKey: ['all-endpoints'],
    queryFn: () => providersApi.getAllModels(),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (endpointId: string) => agentsApi.updateEndpoint(agent.id, endpointId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.agents });
      setOpen(false);
      toast('Endpoint updated', 'success');
    },
    onError: (err) => toast((err as Error).message || 'Failed to update endpoint', 'error'),
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-[6px] px-[10px] py-[5px] rounded-lg text-[11.5px] font-medium transition-[background] duration-100"
        style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer' }}
      >
        <span className="font-mono truncate max-w-[200px]">{agent.endpointName}</span>
        <ChevronDownIcon size={10} />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 rounded-xl overflow-hidden"
          style={{ top: '100%', left: 0, minWidth: 220, background: 'var(--bg-card-2)', boxShadow: 'var(--shadow-float)', border: '1px solid var(--border-hairline)' }}
        >
          {endpoints.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-muted">Loading…</div>
          )}
          {endpoints.map(ep => {
            const isCurrent = ep.id === agent.endpointId;
            return (
              <button
                key={ep.id}
                onClick={() => !isCurrent && mutation.mutate(ep.id)}
                disabled={mutation.isPending}
                className={`w-full text-left px-4 py-[10px] flex flex-col gap-[2px] transition-[background] duration-100${!isCurrent ? ' hover:bg-[var(--bg-card-hover,rgba(255,255,255,0.04))]' : ''}`}
                style={{
                  background: isCurrent ? 'rgba(99,102,241,0.1)' : 'transparent',
                  cursor: isCurrent ? 'default' : 'pointer',
                  border: 'none',
                  borderBottom: '1px solid var(--border-hairline)',
                }}
              >
                <span className="text-[12.5px] font-semibold" style={{ color: isCurrent ? '#a5b4fc' : 'var(--text-primary)' }}>{ep.modelName}</span>
                <span className="text-[11px] text-muted">{ep.providerName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentDetail({ agent, onDelete }: { agent: AgentDto; onDelete: () => void }) {
  const c = agentColor(agent.id);
  return (
    <div className="fade-up flex flex-col gap-[14px]" style={{ animationDelay: '60ms' }}>
      {/* Header card */}
      <div className="bg-card rounded-2xl relative" style={{ boxShadow: 'var(--shadow-card)', borderTop: `3px solid ${c}` }}>
        <button
          onClick={onDelete}
          className="absolute top-3 right-3 flex items-center gap-[5px] btn-icon btn-icon-danger"
          title="Delete agent"
        >
          <TrashIcon size={14} />
        </button>
        <div className="px-5 py-[18px] flex items-start gap-4">
          <div style={{ width: 52, height: 52, borderRadius: 14, background: c + '22', border: `2px solid ${c}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 24px ${c}33` }}>
            <span className="text-xl font-[800] font-mono" style={{ color: c }}>{agent.name[0]}</span>
          </div>
          <div className="flex-1 min-w-0 pr-8">
            <h2 className="text-xl font-bold tracking-[-0.02em] m-0 mb-[8px]">{agent.name}</h2>
            <div className="flex items-center gap-2 flex-wrap mb-[10px]">
              <span className="px-2 py-[2px] bg-card-2 text-muted rounded-md text-[11px]">{agent.projectName}</span>
              <span className="px-[7px] py-[2px] rounded-md text-[11px] font-semibold" style={{ background: `${c}1a`, color: c }}>
                {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-muted">Created {fmtDate(agent.createdAt)}</span>
              <span className="text-[11px] text-muted">·</span>
              <span className="text-[11px] text-muted">Last used {agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}</span>
            </div>
            <div className="flex items-center gap-[8px]">
              <span className="text-[11px] text-muted">Endpoint</span>
              <EndpointSelector agent={agent} />
            </div>
          </div>
        </div>
      </div>

      {/* System prompt */}
      <div className="bg-card rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-4 py-3 flex items-center border-b border-hairline">
          <span className="text-[12.5px] font-semibold">System Prompt</span>
        </div>
        <div className="px-4 py-[14px] max-h-[400px] overflow-y-auto">
          <div className="font-mono text-[11.5px] leading-[1.7] text-primary whitespace-pre-wrap">
            {agent.systemMessage || <span className="text-muted italic">(no system prompt)</span>}
          </div>
        </div>
      </div>

      {/* Tools */}
      {agent.tools.length > 0 && (
        <div className="bg-card rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-4 py-3 flex items-center gap-2 border-b border-hairline">
            <span className="text-[12.5px] font-semibold">Tools</span>
            <span className="px-[7px] py-[1px] rounded-full text-[10.5px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{agent.tools.length}</span>
          </div>
          <div className="flex flex-col">
            {agent.tools.map((tool, ti) => (
              <ToolRow key={tool.name} tool={tool} last={ti === agent.tools.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Agents() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get('id');

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.agents,
    queryFn: () => agentsApi.list({ pageSize: LIST_PAGE_SIZE }),
  });
  const agents = data?.items ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(preselect ?? null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selected = agents.find(a => a.id === selectedId) ?? agents[0] ?? null;

  const delAgent = useMutation({
    mutationFn: () => agentsApi.delete(selected!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.agents });
      const remaining = agents.filter(a => a.id !== selected!.id);
      setSelectedId(remaining[0]?.id ?? null);
      setDeleteOpen(false);
    },
    onError: (err) => toast((err as Error).message || 'Failed to delete agent', 'error'),
  });

  return (
    <div className="w-full max-w-[1360px] mx-auto min-w-0 flex flex-col gap-[14px] overflow-y-auto pb-6">
      <div className="fade-up flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.02em] m-0 mb-[6px]">Agents</h1>
          <p className="text-[13.5px] text-muted m-0">Named agent definitions extracted from traces — system prompts, tools, model params.</p>
        </div>
      </div>

      {isLoading && <div className="text-center p-[40px] text-muted text-[13px]">Loading…</div>}

      {/* Agent selector cards */}
      <div className="fade-up grid gap-3" style={{ animationDelay: '30ms', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', padding: '4px 4px 8px' }}>
        {agents.map(a => {
          const isActive = selected?.id === a.id;
          const c = agentColor(a.id);
          return (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={`border-none cursor-pointer${!isActive ? ' hover:shadow-[var(--shadow-float)]' : ''}`}
              style={{ textAlign: 'left', background: 'var(--bg-card)', borderRadius: 16, padding: 16, boxShadow: isActive ? `0 0 0 1.5px ${c}88, 0 8px 28px -8px ${c}44` : 'var(--shadow-card)', position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.18s' }}
            >
              {isActive && <div style={{ height: 3, position: 'absolute', top: 0, left: 0, right: 0, background: `linear-gradient(90deg, ${c}, ${c}44)` }} />}
              <div className="flex items-start gap-[10px] mt-[6px]">
                <div style={{ width: 38, height: 38, borderRadius: 11, background: c + '1e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${c}33` }}>
                  <span style={{ fontSize: 16, color: c, fontWeight: 800 }}>{a.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold mb-[2px] truncate">{a.name}</div>
                  <div className="text-[11px] text-muted truncate">{a.projectName}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted">{a.tools.length} tool{a.tools.length !== 1 ? 's' : ''}</span>
                <span className="text-[11px] text-muted">{a.lastUsedAt ? fmtRelative(a.lastUsedAt) : 'never'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <AgentDetail
          key={selected.id}
          agent={selected}
          onDelete={() => setDeleteOpen(true)}
        />
      )}

      {!isLoading && agents.length === 0 && (
        <EmptyState title="No agents found" description="Agents are auto-created when traces are captured." />
      )}

      {deleteOpen && selected && (
        <ConfirmDialog
          entityName={selected.name}
          onConfirm={() => delAgent.mutate()}
          onCancel={() => setDeleteOpen(false)}
          loading={delAgent.isPending}
        />
      )}
    </div>
  );
}
