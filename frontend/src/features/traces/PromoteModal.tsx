import { useState } from 'react';
import type { AgentCallDto, MessageDto } from '../../api/models';
import { agentColor } from '../../lib/colors';
import { PlusIcon, CheckIcon, XIcon } from '../../components/icons';

const EVALUATORS = [
  { id: 'tool_call_match', label: 'Tool call match',    desc: 'Checks function name + args are correct',     color: '#10b981' },
  { id: 'semantic',        label: 'Semantic similarity', desc: 'Embedding cosine similarity ≥ threshold',     color: '#8b5cf6' },
  { id: 'exact',           label: 'Exact match',         desc: 'Response must match expected output exactly', color: '#06b6d4' },
  { id: 'llm_judge',       label: 'LLM-as-judge',        desc: 'GPT-4o grades quality 1–5',                  color: '#f59e0b' },
];

export function PromoteModal({ trace, onClose }: { trace: AgentCallDto; onClose: () => void }) {
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
          <CheckIcon size={26} strokeWidth={2.5} />
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
            <PlusIcon strokeWidth={2.5} size={18} />
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
          <button onClick={onClose} className="btn-icon"><XIcon size={14} /></button>
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
              <PlusIcon strokeWidth={2.5} size={13} /> Create {selectedCount > 0 ? selectedCount : ''} test case{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
