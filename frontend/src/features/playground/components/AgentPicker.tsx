import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import type { AgentDto } from '../../../api/models';
import { ChevronDownIcon, CheckIcon } from '../../../components/icons';
import { RowButton } from '../../../components/ui/RowButton';
import { AgentAvatar } from './AgentAvatar';

interface Props {
  projectId: string;
  selectedAgentId: string | null;
  selectedAgent?: AgentDto | null;
  /** Receives the picked agent's id; the caller fetches the full agent (the list is light). */
  onPick: (agentId: string) => void;
  compact?: boolean;
}

export function AgentPicker({ projectId, selectedAgentId, selectedAgent, onPick, compact = false }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['agents', projectId],
    queryFn: () => agentsApi.list({ projectId, pageSize: 200 }),
  });

  const agents = data?.items ?? [];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const current = selectedAgent ?? agents.find(a => a.id === selectedAgentId) ?? null;
  const subtitle = current ? 'Agent' : (isLoading ? 'Loading…' : 'Pick to start');

  return (
    <div ref={ref} className={compact ? 'relative inline-flex' : 'relative'}>
      {/* eslint-disable-next-line no-restricted-syntax -- bespoke avatar dropdown trigger (compact + full layouts) */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isLoading || agents.length === 0}
        data-testid="agent-picker"
        className={
          compact
            ? 'inline-flex items-center gap-[8px] cursor-pointer transition-colors rounded-[10px] pl-[6px] pr-[10px] py-[5px]'
            : 'w-full text-left rounded-[12px] p-[12px] flex items-center gap-[10px] cursor-pointer transition-colors group'
        }
        style={{
          background: compact ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: compact ? undefined : 'var(--shadow-pill)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <AgentAvatar seed={current?.id ?? 'none'} label={current?.name ?? '?'} size={compact ? 26 : 36} />
        {compact ? (
          <span className="text-[12.5px] font-semibold text-primary truncate max-w-[200px]">
            {current?.name ?? 'Pick an agent'}
          </span>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{subtitle}</div>
            <div className="text-[13px] font-semibold text-primary truncate">
              {current?.name ?? 'Pick an agent'}
            </div>
          </div>
        )}
        <ChevronDownIcon
          size={compact ? 12 : 14}
          strokeWidth={2.2}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 top-full mt-[6px] z-20 rounded-[12px] py-[6px] max-h-[320px] overflow-y-auto fade-up ${compact ? 'w-[280px]' : 'right-0'}`}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-float)',
          }}
        >
          {agents.length === 0 ? (
            <div className="px-[12px] py-[10px] text-[12px] text-muted">No agents in this project.</div>
          ) : agents.map(a => {
            const active = a.id === selectedAgentId;
            return (
              <RowButton
                key={a.id}
                role="option"
                aria-selected={active}
                onClick={() => { onPick(a.id); setOpen(false); }}
                data-testid={`agent-picker-option-${a.id}`}
                className="flex items-center gap-[10px] px-[10px] py-[7px] transition-colors hover:bg-card"
                style={active ? { background: 'var(--accent-subtle)' } : undefined}
              >
                <AgentAvatar seed={a.id} label={a.name} size={26} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[12.5px] truncate ${active ? 'text-primary font-semibold' : 'text-secondary'}`}>{a.name}</div>
                  <div className="text-[10.5px] text-muted truncate mono">{a.endpointName}</div>
                </div>
                {active && <CheckIcon size={13} strokeWidth={2.5} />}
              </RowButton>
            );
          })}
        </div>
      )}
    </div>
  );
}
