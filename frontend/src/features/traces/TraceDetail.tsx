import { useState, useEffect } from 'react';
import type { AgentCallDto, MessageDto, ToolSpecDto } from '../../api/models';
import { agentColor, modelColor } from '../../lib/colors';
import { fmtLatency, fmtTokens, fmtDate, fmtRelative } from '../../lib/format';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}


function PlusIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CheckIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── JsonView ─────────────────────────────────────────────────────────────────

function JsonView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span style={{ color: '#a1a1aa' }}>null</span>;
  if (typeof value === 'boolean') return <span style={{ color: '#f472b6' }}>{String(value)}</span>;
  if (typeof value === 'number') return <span style={{ color: '#fbbf24' }}>{value}</span>;
  if (typeof value === 'string') return <span style={{ color: '#86efac' }}>"{value}"</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: '#71717a' }}>[]</span>;
    return (
      <span>
        <span style={{ color: '#71717a' }}>[</span>
        {value.map((v, i) => (
          <div key={i} style={{ paddingLeft: 14 }}>
            <JsonView value={v} depth={depth + 1} />
            {i < value.length - 1 && <span style={{ color: '#71717a' }}>,</span>}
          </div>
        ))}
        <span style={{ color: '#71717a' }}>]</span>
      </span>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span style={{ color: '#71717a' }}>{'{}'}</span>;
  return (
    <span>
      <span style={{ color: '#71717a' }}>{'{'}</span>
      {entries.map(([k, v], i) => (
        <div key={k} style={{ paddingLeft: 14 }}>
          <span style={{ color: '#93c5fd' }}>"{k}"</span>
          <span style={{ color: '#71717a' }}>: </span>
          <JsonView value={v} depth={depth + 1} />
          {i < entries.length - 1 && <span style={{ color: '#71717a' }}>,</span>}
        </div>
      ))}
      <span style={{ color: '#71717a' }}>{'}'}</span>
    </span>
  );
}

// ─── ToolCallBlock ────────────────────────────────────────────────────────────

function ToolCallBlock({ id, name, args }: { id: string; name: string; args: unknown }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-[10px] rounded-[10px] overflow-hidden" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.22)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left flex items-center gap-2 px-3 py-[9px] bg-transparent text-[11.5px] font-mono" style={{ color: '#6ee7b7' }}>
        <span className="inline-flex transition-transform duration-[150ms]" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}><ChevronRight size={10} /></span>
        <span className="font-bold tracking-[0.04em]" style={{ color: '#10b981' }}>TOOL</span>
        <span className="font-semibold" style={{ color: '#d1fae5' }}>{name}</span>
        <span style={{ color: '#71717a' }}>(</span>
        {typeof args === 'object' && args !== null && Object.keys(args as object).slice(0, 2).map((k, i, arr) => (
          <span key={k}>
            <span style={{ color: '#93c5fd' }}>{k}</span>
            <span style={{ color: '#71717a' }}>: </span>
            <span style={{ color: '#fde68a' }}>{JSON.stringify((args as Record<string, unknown>)[k]).slice(0, 24)}</span>
            {i < arr.length - 1 && <span style={{ color: '#71717a' }}>, </span>}
          </span>
        ))}
        {typeof args === 'object' && args !== null && Object.keys(args as object).length > 2 && <span style={{ color: '#71717a' }}>, …</span>}
        <span style={{ color: '#71717a' }}>)</span>
        <span className="ml-auto text-[9.5px] uppercase tracking-[0.08em]" style={{ color: '#52525b' }}>{id}</span>
      </button>
      {open && (
        <div className="px-[14px] pt-[10px] pb-3 pl-[34px] font-mono text-[11.5px] leading-[1.55]" style={{ borderTop: '1px dashed rgba(16,185,129,0.18)' }}>
          <div className="text-[9.5px] tracking-[0.08em] uppercase mb-1" style={{ color: '#52525b' }}>Arguments</div>
          <JsonView value={args} />
        </div>
      )}
    </div>
  );
}

// ─── ToolResultBlock ──────────────────────────────────────────────────────────

function ToolResultBlock({ msg }: { msg: MessageDto }) {
  const [open, setOpen] = useState(true);
  let parsed: unknown = msg.content;
  try { parsed = JSON.parse(msg.content); } catch { /* leave as string */ }
  const sizeB = msg.content?.length ?? 0;
  return (
    <div className="rounded-[10px] overflow-hidden" style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(6,182,212,0.22)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left flex items-center gap-2 px-3 py-[9px] bg-transparent text-[11.5px] font-mono" style={{ color: '#67e8f9' }}>
        <span className="inline-flex transition-transform duration-[150ms]" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}><ChevronRight size={10} /></span>
        <span className="font-bold tracking-[0.04em]" style={{ color: '#06b6d4' }}>RESULT</span>
        <span className="font-semibold" style={{ color: '#cffafe' }}>{msg.toolCallId?.slice(0, 12) ?? '—'}</span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: '#52525b' }}>{sizeB} B</span>
      </button>
      {open && (
        <div className="px-[14px] pt-[10px] pb-3 pl-[34px] font-mono text-[11.5px] leading-[1.55]" style={{ borderTop: '1px dashed rgba(6,182,212,0.18)' }}>
          <JsonView value={parsed} />
        </div>
      )}
    </div>
  );
}

// ─── MessageBlock ─────────────────────────────────────────────────────────────

function MessageBlock({ msg }: { msg: MessageDto }) {
  const styleMap: Record<string, { bg: string; fg: string; label: string }> = {
    system:    { bg: 'rgba(107,107,117,0.12)', fg: '#a1a1aa', label: 'System' },
    user:      { bg: 'rgba(6,182,212,0.14)',   fg: '#67e8f9', label: 'User' },
    assistant: { bg: 'rgba(139,92,246,0.14)',  fg: '#c4b5fd', label: 'Assistant' },
  };
  const s = styleMap[msg.role] ?? styleMap.assistant;
  const content = msg.content;
  if (!content && !msg.toolRequests?.length) return null;
  return (
    <div className="bg-card-2 rounded-xl px-[14px] py-3" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
      <div className="mb-2">
        <span className="px-2 py-[2px] rounded-full text-[10.5px] font-semibold tracking-[0.02em]" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
      </div>
      {content && (
        <div className={`text-[13px] leading-[1.65] whitespace-pre-wrap ${msg.role === 'system' ? 'text-secondary italic' : 'text-primary'}`}>
          {content}
        </div>
      )}
    </div>
  );
}

// ─── ToolSpec ─────────────────────────────────────────────────────────────────

function ToolSpecBlock({ tool }: { tool: ToolSpecDto }) {
  return (
    <div className="bg-card-2 rounded-xl px-[14px] py-3">
      <div className="flex items-center gap-2 mb-[6px]">
        <span className="px-2 py-[2px] rounded-[6px] text-[10.5px] font-bold tracking-[0.04em] font-mono" style={{ background: 'rgba(16,185,129,0.14)', color: '#6ee7b7' }}>FUNCTION</span>
        <span className="font-mono text-[13px] font-semibold">{tool.name}</span>
      </div>
      {tool.description && (
        <div className="text-[12.5px] text-secondary mb-2 leading-[1.5]">{tool.description}</div>
      )}
      {tool.arguments.length > 0 && (
        <div className="font-mono text-[11px] rounded-[6px] px-[10px] py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
          {tool.arguments.map(arg => (
            <div key={arg.name}>
              <span style={{ color: '#93c5fd' }}>{arg.name}</span>
              <span style={{ color: '#71717a' }}>: </span>
              <span style={{ color: '#fde68a' }}>{arg.type}{arg.isRequired ? '' : '?'}</span>
              {arg.description && <span style={{ color: '#71717a' }}> — {arg.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DrawerStat ───────────────────────────────────────────────────────────────

function DrawerStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted font-medium tracking-[0.05em] uppercase">{label}</div>
      <div className="text-[15px] font-bold mt-[3px] font-mono" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-[1px]">{sub}</div>}
    </div>
  );
}

// ─── PromoteModal ─────────────────────────────────────────────────────────────

const EVALUATORS = [
  { id: 'tool_call_match', label: 'Tool call match',    desc: 'Checks function name + args are correct',     color: '#10b981' },
  { id: 'semantic',        label: 'Semantic similarity', desc: 'Embedding cosine similarity ≥ threshold',     color: '#8b5cf6' },
  { id: 'exact',           label: 'Exact match',         desc: 'Response must match expected output exactly', color: '#06b6d4' },
  { id: 'llm_judge',       label: 'LLM-as-judge',        desc: 'GPT-4o grades quality 1–5',                  color: '#f59e0b' },
];

function PromoteModal({ trace, onClose }: { trace: AgentCallDto; onClose: () => void }) {
  const allMessages: MessageDto[] = [...trace.request, ...(trace.response ? [trace.response] : [])];
  const assistantIndices = allMessages.map((m, i) => m.role === 'assistant' ? i : null).filter((i): i is number => i !== null);

  const aColor = agentColor(trace.agentId ?? trace.id);
  const agentLabel = trace.agentName ?? 'Agent';

  const [selected, setSelected] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(assistantIndices.map(i => [i, true]))
  );
  const [names, setNames] = useState<Record<number, string>>(() =>
    Object.fromEntries(assistantIndices.map((i, n) => [i, `TC-${String(n + 1).padStart(2, '0')} · ${agentLabel}`]))
  );
  const [evaluators, setEvaluators] = useState<Record<number, string>>(() =>
    Object.fromEntries(assistantIndices.map(i => {
      const m = allMessages[i];
      return [i, m.toolRequests?.length ? 'tool_call_match' : 'semantic'];
    }))
  );
  const [expanded, setExpanded] = useState<number | null>(null);
  const [step, setStep] = useState<'select' | 'done'>('select');
  const selectedCount = Object.values(selected).filter(Boolean).length;

  if (step === 'done') return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center fade-up" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-[20px] px-[56px] py-[48px] text-center max-w-[440px]" style={{ boxShadow: 'var(--shadow-float)' }}>
        <div className="w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-[18px] text-white" style={{ background: 'linear-gradient(135deg, #8b5cf6, #10b981)', boxShadow: '0 8px 24px -8px rgba(139,92,246,0.6)' }}>
          <CheckIcon size={26} />
        </div>
        <h2 className="text-[20px] font-bold tracking-[-0.02em] mb-2">{selectedCount} test case{selectedCount !== 1 ? 's' : ''} created</h2>
        <p className="text-[13.5px] text-muted leading-[1.6] mb-7">
          Added to <span className="text-primary font-semibold">{agentLabel}</span> suite.
        </p>
        <div className="flex gap-[10px] justify-center">
          <button onClick={onClose} className="px-5 py-[10px] bg-card-2 rounded-[10px] text-[13px] font-medium text-secondary" style={{ boxShadow: 'var(--shadow-pill)' }}>Back to trace</button>
        </div>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center p-5 fade-up" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-[1060px] h-[min(780px,90vh)] bg-card rounded-[20px] flex flex-col overflow-hidden" style={{ boxShadow: 'var(--shadow-float)' }}>
        {/* Header */}
        <div className="px-6 py-[18px] flex items-center gap-[14px] border-b border-hairline">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
            <PlusIcon size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold">Promote to Test Cases</h2>
            <p className="text-[12px] text-muted mt-[2px]">Select which assistant turns to promote, then configure each test case.</p>
          </div>
          <span className="inline-flex items-center gap-[6px] px-[9px] py-[3px] rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: `${aColor}1f`, color: aColor, border: `1px solid ${aColor}2e` }}>
            <span className="w-[5px] h-[5px] rounded-full" style={{ background: aColor }} />
            {agentLabel}
          </span>
          <span className="mono text-[11px] text-muted">{trace.id.slice(0, 10)}…</span>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-[8px] bg-card-2 text-muted flex items-center justify-center shrink-0">✕</button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: conversation timeline */}
          <div className="w-[340px] shrink-0 border-r border-hairline overflow-y-auto py-4">
            <div className="px-[18px] pb-[10px] text-[10.5px] font-semibold text-muted tracking-[0.08em] uppercase">
              Conversation · {allMessages.length} messages
            </div>
            {allMessages.map((msg, i) => {
              const isAssistant = msg.role === 'assistant';
              const assistantOrdinal = isAssistant ? assistantIndices.indexOf(i) : -1;
              const isSelected = isAssistant && selected[i];
              return (
                <div key={i}
                  onClick={isAssistant ? () => setExpanded(expanded === i ? null : i) : undefined}
                  className="flex gap-3 px-[18px] py-2 transition-[background] duration-[120ms]"
                  style={{ cursor: isAssistant ? 'pointer' : 'default', background: isAssistant && expanded === i ? 'rgba(139,92,246,0.05)' : 'transparent' }}>
                  <div className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white transition-all duration-[150ms]"
                    style={{
                      background: isAssistant ? (isSelected ? aColor : 'var(--bg-card-2)') : msg.role === 'user' ? '#0e7490' : msg.role === 'tool' ? '#065f46' : '#52525b',
                      border: isAssistant && isSelected ? `2px solid ${aColor}` : '2px solid var(--border-color)',
                      boxShadow: isAssistant && isSelected ? `0 0 12px ${aColor}66` : 'none',
                    }}>
                    {isAssistant ? (assistantOrdinal + 1) : ''}
                  </div>
                  <div className="flex-1 min-w-0 pt-[2px]">
                    <div className="text-[12px] text-secondary leading-[1.5] overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                      <span className="text-[10px] font-semibold mr-[6px]" style={{ color: isAssistant ? aColor : msg.role === 'user' ? '#67e8f9' : '#a1a1aa' }}>{msg.role.toUpperCase()}</span>
                      {msg.content?.slice(0, 80)}{(msg.content?.length ?? 0) > 80 ? '…' : ''}
                      {msg.toolRequests?.length > 0 && <span className="font-mono text-[11px]" style={{ color: '#6ee7b7' }}> {msg.toolRequests.map(c => `${c.name}()`).join(', ')}</span>}
                    </div>
                    {isAssistant && (
                      <div className="mt-2 flex items-center gap-2">
                        <label onClick={e => e.stopPropagation()} className="flex items-center gap-[6px] cursor-pointer">
                          <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected(s => ({ ...s, [i]: !s[i] }))} className="w-[13px] h-[13px]" style={{ accentColor: aColor }} />
                          <span className="text-[11px] text-muted">Promote this turn</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: per-case config */}
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-[14px]">
            {assistantIndices.filter(i => selected[i]).length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted text-[13px] flex-col gap-2">
                <span className="text-[28px]">☐</span>
                <span>Select at least one assistant turn on the left.</span>
              </div>
            ) : assistantIndices.filter(i => selected[i]).map((msgIdx, n) => {
              const msg = allMessages[msgIdx];
              return (
                <div key={msgIdx} className="bg-card-2 rounded-[14px] overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-[10px] border-b border-hairline">
                    <div className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: aColor }}>{n + 1}</div>
                    <input value={names[msgIdx] ?? ''} onChange={e => setNames(ns => ({ ...ns, [msgIdx]: e.target.value }))} className="flex-1 bg-transparent border-none outline-none text-[13px] font-semibold text-primary font-[Inter,sans-serif]" placeholder="Test case name…" />
                    {msg.toolRequests?.length > 0 && <span className="px-[7px] py-[2px] rounded-[5px] text-[10px] font-mono font-semibold" style={{ background: 'rgba(16,185,129,0.14)', color: '#6ee7b7' }}>TOOL CALL</span>}
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.08em] mb-2">Evaluator</div>
                    <div className="grid grid-cols-2 gap-[5px]">
                      {EVALUATORS.map(e => {
                        const isActive = evaluators[msgIdx] === e.id;
                        return (
                          <button key={e.id} onClick={() => setEvaluators(ev => ({ ...ev, [msgIdx]: e.id }))} className="px-2 py-[7px] rounded-[8px] text-left transition-all duration-[120ms]" style={{ background: isActive ? `${e.color}1a` : 'rgba(0,0,0,0.2)', boxShadow: isActive ? `inset 0 0 0 1.5px ${e.color}55` : 'none' }}>
                            <div className="text-[11px] font-semibold mb-[2px]" style={{ color: isActive ? e.color : 'var(--text-secondary)' }}>{e.label}</div>
                            <div className="text-[9.5px] text-muted leading-[1.4]">{e.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-[14px] border-t border-hairline flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.15)' }}>
          <div className="text-[12.5px] text-muted">
            <span className="text-primary font-semibold">{selectedCount}</span> of <span className="text-secondary">{assistantIndices.length}</span> turns selected
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-[18px] py-[9px] bg-card-2 rounded-[10px] text-[13px] font-medium text-secondary" style={{ boxShadow: 'var(--shadow-pill)' }}>Cancel</button>
            <button onClick={() => selectedCount > 0 && setStep('done')} disabled={selectedCount === 0} className="px-5 py-[9px] rounded-[10px] text-[13px] font-semibold inline-flex items-center gap-[6px]" style={{ background: selectedCount > 0 ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'var(--bg-card-2)', color: selectedCount > 0 ? '#fff' : 'var(--text-muted)', boxShadow: selectedCount > 0 ? '0 4px 14px -4px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none' }}>
              <PlusIcon size={13} /> Create {selectedCount > 0 ? selectedCount : ''} test case{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TraceDetail ──────────────────────────────────────────────────────────────

interface Props {
  trace: AgentCallDto;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

type Tab = 'Messages' | 'Tools' | 'Raw JSON' | 'Metadata';

export function TraceDetail({ trace, onClose, onPrev, onNext }: Props) {
  const [tab, setTab] = useState<Tab>('Messages');
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    setTab('Messages');
    setPromoting(false);
  }, [trace.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (promoting) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, promoting]);

  const aColor = agentColor(trace.agentId ?? trace.id);
  const mColor = modelColor(trace.model);
  const statusOk = trace.httpStatus >= 200 && trace.httpStatus < 300;
  const statusErr = trace.httpStatus >= 500;
  const statusColor = statusOk ? 'var(--success)' : statusErr ? 'var(--danger)' : 'var(--warn)';
  const statusLabel = statusOk ? 'OK' : statusErr ? 'ERROR' : 'RATE_LIMIT';
  const tokTotal = trace.inputTokens + trace.outputTokens;

  const allMessages: MessageDto[] = [...trace.request, ...(trace.response ? [trace.response] : [])];
  const toolCallCount = allMessages.reduce((n, m) => n + (m.toolRequests?.length ?? 0), 0);
  const msgCount = allMessages.length;

  const TABS: [Tab, number | null][] = [
    ['Messages', msgCount],
    ['Tools', trace.tools.length],
    ['Raw JSON', null],
    ['Metadata', null],
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.4)' }}
      />

      {/* Panel */}
      <div
        className="fixed top-[76px] right-[10px] bottom-[10px] w-[min(720px,92vw)] bg-card rounded-[18px] flex flex-col overflow-hidden z-[51]"
        style={{ boxShadow: 'var(--shadow-float)', animation: 'fade-up 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-hairline shrink-0">
          <button onClick={onClose} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-muted bg-card-2 shrink-0">
            <ChevronRight size={14} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: aColor, boxShadow: `0 0 8px ${aColor}` }} />
              <span className="mono text-[13px] font-semibold">{trace.id.slice(0, 18)}…</span>
              <span className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-full text-[10.5px] font-semibold font-mono" style={{ background: statusOk ? 'var(--success-subtle)' : statusErr ? 'var(--danger-subtle)' : 'rgba(212,145,92,0.15)', color: statusColor }}>
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: statusColor }} />
                {trace.httpStatus} {statusLabel}
              </span>
            </div>
            <div className="mt-[6px] flex items-center gap-2 flex-wrap">
              {trace.agentName && (
                <span className="inline-flex items-center gap-[6px] pl-2 pr-[9px] py-[3px] rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: `${aColor}1f`, color: aColor, border: `1px solid ${aColor}2e` }}>
                  <span className="w-[5px] h-[5px] rounded-full" style={{ background: aColor, boxShadow: `0 0 6px ${aColor}99` }} />
                  {trace.agentName}
                </span>
              )}
              <span className="inline-flex items-center gap-[5px] px-2 py-[3px] rounded-full text-[11px] font-medium font-mono" style={{ background: `${mColor}1f`, color: mColor, border: `1px solid ${mColor}33` }}>
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: mColor }} />
                {trace.model}
              </span>
              <span className="text-[11px] text-muted">· {fmtRelative(trace.createdAt)} · {msgCount} msg{msgCount !== 1 ? 's' : ''} · {toolCallCount} tool call{toolCallCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {onPrev && (
            <button onClick={onPrev} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-muted bg-card-2 shrink-0 rotate-180">
              <ChevronRight size={14} />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-muted bg-card-2 shrink-0">
              <ChevronRight size={14} />
            </button>
          )}
          <button onClick={() => setPromoting(true)} className="px-3 py-[7px] rounded-[8px] text-[12px] font-semibold text-white inline-flex items-center gap-[5px] shrink-0" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', boxShadow: '0 4px 12px -4px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            <PlusIcon size={12} /> Promote to test case
          </button>
        </div>

        {/* Stat band */}
        <div className="mx-5 mt-[14px] px-4 py-[14px] bg-card-2 rounded-xl grid grid-cols-5 gap-[14px] shrink-0" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset' }}>
          <DrawerStat label="Latency" value={fmtLatency(trace.durationMs)} sub={trace.durationMs > 3000 ? 'slow' : 'normal'} color={trace.durationMs > 3000 ? 'var(--warn)' : undefined} />
          <DrawerStat label="Input"  value={fmtTokens(trace.inputTokens)}  sub="tokens" />
          <DrawerStat label="Output" value={fmtTokens(trace.outputTokens)} sub="tokens" />
          <DrawerStat label="Total"  value={fmtTokens(tokTotal)}            sub="tokens" />
          <DrawerStat label="Cost"   value={trace.costEur != null ? `€${trace.costEur.toFixed(4)}` : '—'} sub={trace.costEur != null ? 'EUR' : undefined} />
        </div>

        {/* Tabs */}
        <div className="px-5 pt-[14px] flex gap-1 border-b border-hairline shrink-0">
          {TABS.map(([t, count]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-[14px] pt-[9px] pb-[11px] text-[12.5px] font-medium bg-transparent -mb-px inline-flex items-center gap-[6px] transition-colors duration-[120ms] border-b-2 ${tab === t ? 'text-primary border-b-[#8b5cf6]' : 'text-muted border-b-transparent'}`}>
              {t}
              {count !== null && (
                <span className="px-[6px] py-[1px] rounded-full text-[10px] font-mono font-semibold" style={{ background: tab === t ? 'rgba(139,92,246,0.18)' : 'var(--bg-card-2)', color: tab === t ? '#c4b5fd' : 'var(--text-muted)' }}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto px-5 pt-[14px] pb-7 flex flex-col gap-[10px]">
          {tab === 'Messages' && (
            <>
              {allMessages.map((msg, i) => {
                if (msg.role === 'tool') return <ToolResultBlock key={i} msg={msg} />;
                return (
                  <div key={i}>
                    <MessageBlock msg={msg} />
                    {msg.toolRequests?.map(call => {
                      let args: unknown = call.arguments;
                      try { args = JSON.parse(call.arguments); } catch { /* leave as string */ }
                      return <ToolCallBlock key={call.id} id={call.id} name={call.name} args={args} />;
                    })}
                  </div>
                );
              })}
              {trace.finishReason && (
                <div className="mt-1 px-3 py-2 bg-card-2 rounded-[8px] text-[11px] text-muted font-mono flex items-center gap-2">
                  <span className="text-success">●</span>
                  finish_reason: <span className="text-secondary">{trace.finishReason}</span>
                  <span className="ml-auto">completed in {fmtLatency(trace.durationMs)}</span>
                </div>
              )}
            </>
          )}

          {tab === 'Tools' && (
            trace.tools.length === 0
              ? <div className="px-5 py-[40px] text-center text-muted text-[13px]">No tools were declared for this call.</div>
              : trace.tools.map(tool => <ToolSpecBlock key={tool.name} tool={tool} />)
          )}

          {tab === 'Raw JSON' && (
            <div className="rounded-[10px] px-4 py-[14px] font-mono text-[11.5px] leading-[1.55] overflow-auto" style={{ background: 'rgba(0,0,0,0.28)' }}>
              <JsonView value={{
                id: trace.id,
                object: 'chat.completion',
                model: trace.model,
                provider: trace.provider,
                agentId: trace.agentId,
                agentName: trace.agentName,
                usage: {
                  prompt_tokens: trace.inputTokens,
                  completion_tokens: trace.outputTokens,
                  total_tokens: tokTotal,
                },
                finish_reason: trace.finishReason,
                http_status: trace.httpStatus,
                duration_ms: trace.durationMs,
                created_at: trace.createdAt,
              }} />
            </div>
          )}

          {tab === 'Metadata' && (
            <div className="grid grid-cols-2 gap-[10px]">
              {([
                ['trace.id', trace.id],
                ['provider', trace.provider],
                ['model', trace.model],
                ['agent', trace.agentName ?? '—'],
                ['http_status', String(trace.httpStatus)],
                ['finish_reason', trace.finishReason ?? '—'],
                ['duration_ms', String(trace.durationMs)],
                ['input_tokens', String(trace.inputTokens)],
                ['output_tokens', String(trace.outputTokens)],
                ['cost_eur', trace.costEur != null ? trace.costEur.toFixed(6) : '—'],
                ['created_at', fmtDate(trace.createdAt)],
                ['updated_at', fmtDate(trace.updatedAt)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="px-3 py-[10px] bg-card-2 rounded-[8px]">
                  <div className="text-[10px] text-muted uppercase tracking-[0.06em] mb-[3px]">{k}</div>
                  <div className="text-[12px] font-mono text-primary break-all">{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {promoting && <PromoteModal trace={trace} onClose={() => setPromoting(false)} />}
    </>
  );
}
