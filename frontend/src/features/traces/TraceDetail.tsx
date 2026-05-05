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

function ChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
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
    <div style={{ marginTop: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'transparent', fontSize: 11.5, color: '#6ee7b7', fontFamily: "'JetBrains Mono', monospace" }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-flex' }}><ChevronRight size={10} /></span>
        <span style={{ color: '#10b981', fontWeight: 700, letterSpacing: '0.04em' }}>TOOL</span>
        <span style={{ color: '#d1fae5', fontWeight: 600 }}>{name}</span>
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
        <span style={{ marginLeft: 'auto', fontSize: 9.5, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{id}</span>
      </button>
      {open && (
        <div style={{ padding: '10px 14px 12px 34px', borderTop: '1px dashed rgba(16,185,129,0.18)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.55 }}>
          <div style={{ color: '#52525b', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Arguments</div>
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
    <div style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(6,182,212,0.22)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'transparent', fontSize: 11.5, color: '#67e8f9', fontFamily: "'JetBrains Mono', monospace" }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-flex' }}><ChevronRight size={10} /></span>
        <span style={{ color: '#06b6d4', fontWeight: 700, letterSpacing: '0.04em' }}>RESULT</span>
        <span style={{ color: '#cffafe', fontWeight: 600 }}>{msg.toolCallId?.slice(0, 12) ?? '—'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#52525b', fontFamily: "'JetBrains Mono', monospace" }}>{sizeB} B</span>
      </button>
      {open && (
        <div style={{ padding: '10px 14px 12px 34px', borderTop: '1px dashed rgba(6,182,212,0.18)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.55 }}>
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
    <div style={{ background: 'var(--bg-card-2)', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ padding: '2px 8px', borderRadius: 100, background: s.bg, color: s.fg, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em' }}>{s.label}</span>
      </div>
      {content && (
        <div style={{ fontSize: 13, lineHeight: 1.65, color: msg.role === 'system' ? 'var(--text-secondary)' : 'var(--text-primary)', whiteSpace: 'pre-wrap', fontStyle: msg.role === 'system' ? 'italic' : 'normal' }}>
          {content}
        </div>
      )}
    </div>
  );
}

// ─── ToolSpec ─────────────────────────────────────────────────────────────────

function ToolSpecBlock({ tool }: { tool: ToolSpecDto }) {
  return (
    <div style={{ background: 'var(--bg-card-2)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.14)', color: '#6ee7b7', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', fontFamily: "'JetBrains Mono', monospace" }}>FUNCTION</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>{tool.name}</span>
      </div>
      {tool.description && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>{tool.description}</div>
      )}
      {tool.arguments.length > 0 && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '8px 10px' }}>
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
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, color: color ?? 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fade-up 0.2s ease-out' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '48px 56px', textAlign: 'center', boxShadow: 'var(--shadow-float)', maxWidth: 440 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #8b5cf6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 8px 24px -8px rgba(139,92,246,0.6)', color: '#fff' }}>
          <CheckIcon size={26} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{selectedCount} test case{selectedCount !== 1 ? 's' : ''} created</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 28 }}>
          Added to <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{agentLabel}</span> suite.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'var(--bg-card-2)', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', boxShadow: 'var(--shadow-pill)' }}>Back to trace</button>
        </div>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fade-up 0.2s ease-out' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1060, height: 'min(780px, 90vh)', background: 'var(--bg-card)', borderRadius: 20, boxShadow: 'var(--shadow-float)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--hairline)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            <PlusIcon size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Promote to Test Cases</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Select which assistant turns to promote, then configure each test case.</p>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 100, background: `${aColor}1f`, color: aColor, fontSize: 11, fontWeight: 600, border: `1px solid ${aColor}2e`, whiteSpace: 'nowrap' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: aColor }} />
            {agentLabel}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{trace.id.slice(0, 10)}…</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-card-2)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: conversation timeline */}
          <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--hairline)', overflowY: 'auto', padding: '16px 0' }}>
            <div style={{ padding: '0 18px 10px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Conversation · {allMessages.length} messages
            </div>
            {allMessages.map((msg, i) => {
              const isAssistant = msg.role === 'assistant';
              const assistantOrdinal = isAssistant ? assistantIndices.indexOf(i) : -1;
              const isSelected = isAssistant && selected[i];
              return (
                <div key={i}
                  onClick={isAssistant ? () => setExpanded(expanded === i ? null : i) : undefined}
                  style={{ display: 'flex', gap: 12, padding: '8px 18px', cursor: isAssistant ? 'pointer' : 'default', background: isAssistant && expanded === i ? 'rgba(139,92,246,0.05)' : 'transparent', transition: 'background 0.12s' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: isAssistant ? (isSelected ? aColor : 'var(--bg-card-2)') : msg.role === 'user' ? '#0e7490' : msg.role === 'tool' ? '#065f46' : '#52525b', border: isAssistant && isSelected ? `2px solid ${aColor}` : '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', boxShadow: isAssistant && isSelected ? `0 0 12px ${aColor}66` : 'none', transition: 'all 0.15s' }}>
                    {isAssistant ? (assistantOrdinal + 1) : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: isAssistant ? aColor : msg.role === 'user' ? '#67e8f9' : '#a1a1aa', marginRight: 6 }}>{msg.role.toUpperCase()}</span>
                      {msg.content?.slice(0, 80)}{(msg.content?.length ?? 0) > 80 ? '…' : ''}
                      {msg.toolRequests?.length > 0 && <span style={{ color: '#6ee7b7', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}> {msg.toolRequests.map(c => `${c.name}()`).join(', ')}</span>}
                    </div>
                    {isAssistant && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected(s => ({ ...s, [i]: !s[i] }))} style={{ accentColor: aColor, width: 13, height: 13 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Promote this turn</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: per-case config */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {assistantIndices.filter(i => selected[i]).length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 28 }}>☐</span>
                <span>Select at least one assistant turn on the left.</span>
              </div>
            ) : assistantIndices.filter(i => selected[i]).map((msgIdx, n) => {
              const msg = allMessages[msgIdx];
              const ev = EVALUATORS.find(e => e.id === evaluators[msgIdx]);
              return (
                <div key={msgIdx} style={{ background: 'var(--bg-card-2)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--hairline)' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: aColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{n + 1}</div>
                    <input value={names[msgIdx] ?? ''} onChange={e => setNames(ns => ({ ...ns, [msgIdx]: e.target.value }))} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }} placeholder="Test case name…" />
                    {msg.toolRequests?.length > 0 && <span style={{ padding: '2px 7px', background: 'rgba(16,185,129,0.14)', color: '#6ee7b7', borderRadius: 5, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>TOOL CALL</span>}
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Evaluator</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                      {EVALUATORS.map(e => {
                        const isActive = evaluators[msgIdx] === e.id;
                        return (
                          <button key={e.id} onClick={() => setEvaluators(ev => ({ ...ev, [msgIdx]: e.id }))} style={{ padding: '7px 8px', borderRadius: 8, textAlign: 'left', background: isActive ? `${e.color}1a` : 'rgba(0,0,0,0.2)', boxShadow: isActive ? `inset 0 0 0 1.5px ${e.color}55` : 'none', transition: 'all 0.12s' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? e.color : 'var(--text-secondary)', marginBottom: 2 }}>{e.label}</div>
                            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{e.desc}</div>
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
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedCount}</span> of <span style={{ color: 'var(--text-secondary)' }}>{assistantIndices.length}</span> turns selected
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: 'var(--bg-card-2)', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', boxShadow: 'var(--shadow-pill)' }}>Cancel</button>
            <button onClick={() => selectedCount > 0 && setStep('done')} disabled={selectedCount === 0} style={{ padding: '9px 20px', background: selectedCount > 0 ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'var(--bg-card-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: selectedCount > 0 ? '#fff' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: selectedCount > 0 ? '0 4px 14px -4px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none' }}>
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
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }}
      />

      {/* Panel */}
      <div
        style={{ position: 'fixed', top: 76, right: 10, bottom: 10, width: 'min(720px, 92vw)', background: 'var(--bg-card)', borderRadius: 18, boxShadow: 'var(--shadow-float)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 51, animation: 'fade-up 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-2)', flexShrink: 0 }}>
            <ChevronRight size={14} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: aColor, boxShadow: `0 0 8px ${aColor}`, flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{trace.id.slice(0, 18)}…</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', background: `${statusOk ? 'var(--success-subtle)' : statusErr ? 'var(--danger-subtle)' : 'rgba(212,145,92,0.15)'}`, color: statusColor, borderRadius: 100, fontSize: 10.5, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
                {trace.httpStatus} {statusLabel}
              </span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {trace.agentName && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px 3px 8px', borderRadius: 100, background: `${aColor}1f`, color: aColor, fontSize: 11, fontWeight: 600, border: `1px solid ${aColor}2e`, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: aColor, boxShadow: `0 0 6px ${aColor}99` }} />
                  {trace.agentName}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 100, background: `${mColor}1f`, color: mColor, fontSize: 11, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${mColor}33` }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: mColor }} />
                {trace.model}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {fmtRelative(trace.createdAt)} · {msgCount} msg{msgCount !== 1 ? 's' : ''} · {toolCallCount} tool call{toolCallCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {onPrev && (
            <button onClick={onPrev} style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-2)', flexShrink: 0, transform: 'rotate(180deg)' }}>
              <ChevronRight size={14} />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-2)', flexShrink: 0 }}>
              <ChevronRight size={14} />
            </button>
          )}
          <button onClick={() => setPromoting(true)} style={{ padding: '7px 12px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', boxShadow: '0 4px 12px -4px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.15)', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <PlusIcon size={12} /> Promote to test case
          </button>
        </div>

        {/* Stat band */}
        <div style={{ margin: '14px 20px 0', padding: '14px 16px', background: 'var(--bg-card-2)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset', flexShrink: 0 }}>
          <DrawerStat label="Latency" value={fmtLatency(trace.durationMs)} sub={trace.durationMs > 3000 ? 'slow' : 'normal'} color={trace.durationMs > 3000 ? 'var(--warn)' : undefined} />
          <DrawerStat label="Input"  value={fmtTokens(trace.inputTokens)}  sub="tokens" />
          <DrawerStat label="Output" value={fmtTokens(trace.outputTokens)} sub="tokens" />
          <DrawerStat label="Total"  value={fmtTokens(tokTotal)}            sub="tokens" />
          <DrawerStat label="Cost"   value={trace.costEur != null ? `€${trace.costEur.toFixed(4)}` : '—'} sub={trace.costEur != null ? 'EUR' : undefined} />
        </div>

        {/* Tabs */}
        <div style={{ padding: '14px 20px 0', display: 'flex', gap: 4, borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
          {TABS.map(([t, count]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 14px 11px', fontSize: 12.5, fontWeight: 500, color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)', background: 'transparent', borderBottom: tab === t ? '2px solid #8b5cf6' : '2px solid transparent', marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.12s' }}>
              {t}
              {count !== null && (
                <span style={{ padding: '1px 6px', background: tab === t ? 'rgba(139,92,246,0.18)' : 'var(--bg-card-2)', color: tab === t ? '#c4b5fd' : 'var(--text-muted)', borderRadius: 100, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                <div style={{ marginTop: 4, padding: '8px 12px', background: 'var(--bg-card-2)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--success)' }}>●</span>
                  finish_reason: <span style={{ color: 'var(--text-secondary)' }}>{trace.finishReason}</span>
                  <span style={{ marginLeft: 'auto' }}>completed in {fmtLatency(trace.durationMs)}</span>
                </div>
              )}
            </>
          )}

          {tab === 'Tools' && (
            trace.tools.length === 0
              ? <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No tools were declared for this call.</div>
              : trace.tools.map(tool => <ToolSpecBlock key={tool.name} tool={tool} />)
          )}

          {tab === 'Raw JSON' && (
            <div style={{ background: 'rgba(0,0,0,0.28)', borderRadius: 10, padding: '14px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.55, overflow: 'auto' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                <div key={k} style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', wordBreak: 'break-all' }}>{v}</div>
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
