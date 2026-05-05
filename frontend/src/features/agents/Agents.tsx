import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { agentsApi } from '../../api/agents';
import type { AgentDto, ToolSpecDto } from '../../api/models';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { agentColor } from '../../lib/colors';
import { fmtDate, fmtRelative } from '../../lib/format';

const TYPE_COLORS: Record<string, string> = {
  string: '#93c5fd', integer: '#fbbf24', number: '#fbbf24',
  boolean: '#f472b6', enum: '#6ee7b7', object: '#f9a8d4', array: '#86efac',
};

function requiredParams(tool: ToolSpecDto) {
  const req = tool.arguments.filter(a => a.isRequired).map(a => a.name);
  return req.length ? `(${req.join(', ')})` : '()';
}

function ToolRow({ tool, last }: { tool: ToolSpecDto; last: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--hairline)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'transparent', transition: 'background 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.04)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-flex', color: 'var(--text-muted)', flexShrink: 0, fontSize: 10 }}>▶</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#6ee7b7' }}>{tool.name}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>{requiredParams(tool)}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{tool.description}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px 38px' }}>
          {tool.description && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12, padding: '8px 12px', background: 'rgba(16,185,129,0.05)', borderRadius: 8, borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
              {tool.description}
            </div>
          )}
          {tool.arguments.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Parameters</div>
              <div style={{ background: 'rgba(0,0,0,0.22)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.4fr 2.5fr', padding: '7px 12px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--hairline)' }}>
                  <span>Name</span><span>Type</span><span>Req</span><span>Description</span>
                </div>
                {tool.arguments.map((p, i) => (
                  <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.4fr 2.5fr', padding: '9px 12px', alignItems: 'start', borderBottom: i < tool.arguments.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>{p.name}</span>
                    <span style={{ padding: '2px 7px', borderRadius: 4, background: (TYPE_COLORS[p.type] ?? '#888') + '20', color: TYPE_COLORS[p.type] ?? '#888', fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{p.type}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.isRequired ? 'var(--danger)' : 'var(--text-muted)' }}>{p.isRequired ? '✓' : '—'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{p.description ?? '—'}</span>
                  </div>
                ))}
              </div>
              {tool.arguments.some(a => a.enumValues?.length) && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {tool.arguments.filter(a => a.enumValues?.length).flatMap(a => (a.enumValues ?? []).map(v => (
                    <span key={`${a.name}-${v}`} style={{ padding: '1px 5px', background: 'rgba(110,231,183,0.1)', color: '#6ee7b7', borderRadius: 3, fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
                  )))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AgentDetail({ agent, onDelete }: { agent: AgentDto; onDelete: () => void }) {
  const c = agentColor(agent.id);
  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, animationDelay: '60ms' }}>
      {/* Header card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${c}, ${c}44)` }} />
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: c + '22', border: `2px solid ${c}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 24px ${c}33` }}>
            <span style={{ fontSize: 20, color: c, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{agent.name[0]}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{agent.name}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 8px', background: 'var(--bg-card-2)', color: 'var(--text-muted)', borderRadius: 6, fontSize: 11 }}>{agent.projectName}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Created {fmtDate(agent.createdAt)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last used {agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
            {[
              { label: 'Tools', value: String(agent.tools.length) },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px 14px', background: 'var(--bg-card-2)', borderRadius: 10, textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
            <button
              onClick={onDelete}
              style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', border: 'none', cursor: 'pointer' }}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      </div>

      {/* System prompt */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--hairline)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>
            System Prompt — <span style={{ fontFamily: "'JetBrains Mono', monospace", color: c }}>current</span>
          </span>
        </div>
        <div style={{ padding: '14px 16px', maxHeight: 400, overflowY: 'auto' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {agent.systemMessage || '(no system prompt)'}
          </div>
        </div>
      </div>

      {/* Tools */}
      {agent.tools.length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--hairline)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>
              Tools <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#10b981', fontSize: 11 }}>({agent.tools.length})</span>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get('id');

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list({ pageSize: 200 }),
  });
  const agents = data?.items ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(preselect ?? null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selected = agents.find(a => a.id === selectedId) ?? agents[0] ?? null;

  const delAgent = useMutation({
    mutationFn: () => agentsApi.delete(selected!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      const remaining = agents.filter(a => a.id !== selected!.id);
      setSelectedId(remaining[0]?.id ?? null);
      setDeleteOpen(false);
    },
  });

  return (
    <div style={{ width: '100%', maxWidth: 1360, margin: '0 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingBottom: 24 }}>
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6, margin: '0 0 6px' }}>Agents</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>Named agent definitions extracted from traces — system prompts, tools, model params.</p>
        </div>
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}

      {/* Agent selector cards */}
      <div className="fade-up" style={{ animationDelay: '30ms', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {agents.map(a => {
          const isActive = selected?.id === a.id;
          const c = agentColor(a.id);
          return (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              style={{ textAlign: 'left', background: 'var(--bg-card)', borderRadius: 16, padding: 16, boxShadow: isActive ? `0 1px 0 rgba(255,255,255,0.07) inset, 0 0 0 1.5px ${c}66, 0 10px 32px -10px ${c}55` : 'var(--shadow-card)', position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.18s', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.boxShadow = 'var(--shadow-float)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
            >
              <div style={{ height: 3, position: 'absolute', top: 0, left: 0, right: 0, background: `linear-gradient(90deg, ${c}, ${c}44)` }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 6 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: c + '1e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${c}33` }}>
                  <span style={{ fontSize: 16, color: c, fontWeight: 800 }}>{a.name[0]}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.projectName}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.tools.length} tool{a.tools.length !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.lastUsedAt ? fmtRelative(a.lastUsedAt) : 'never'}</span>
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
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
          No agents found. Agents are auto-created when traces are captured.
        </div>
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
