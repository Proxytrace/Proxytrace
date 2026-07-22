import { useEffect, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AgentDto } from '../../../api/models';
import { usePlaygroundAgents } from '../hooks/usePlaygroundAgents';
import { ChevronDownIcon, CheckIcon } from '../../../components/icons';
import { RowButton } from '../../../components/ui/RowButton';
import { cn } from '../../../lib/cn';
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
  const { t } = useLingui();
  const { data, isLoading } = usePlaygroundAgents(projectId);

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
  const subtitle = current ? t`Agent` : (isLoading ? t`Loading…` : t`Pick to start`);

  return (
    <div ref={ref} className={compact ? 'relative inline-flex' : 'relative'}>
      {/* eslint-disable-next-line no-restricted-syntax -- bespoke avatar dropdown trigger (compact + full layouts) */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isLoading || agents.length === 0}
        data-testid="agent-picker"
        className={cn(
          'border border-border',
          compact
            ? 'inline-flex items-center gap-2 cursor-pointer transition-colors rounded-md pl-1.5 pr-2.5 py-1.5 bg-white/[0.03]'
            : 'w-full text-left rounded-lg p-3 flex items-center gap-2.5 cursor-pointer transition-colors group bg-card',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* eslint-disable-next-line lingui/no-unlocalized-strings -- avatar hash seed token, not UI copy */}
        <AgentAvatar seed={current?.id ?? 'none'} label={current?.name ?? '?'} size={compact ? 26 : 36} />
        {compact ? (
          <span className="text-body font-semibold text-primary truncate max-w-[200px]">
            {current?.name ?? t`Pick an agent`}
          </span>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">{subtitle}</div>
            <div className="text-title font-semibold text-primary truncate">
              {current?.name ?? t`Pick an agent`}
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
          className={cn('absolute left-0 top-full mt-1.5 z-20 rounded-lg py-1.5 max-h-[320px] overflow-y-auto fade-up bg-surface-2 border border-border shadow-[var(--shadow-float)]', compact ? 'w-[280px]' : 'right-0')}
        >
          {agents.length === 0 ? (
            <div className="px-3 py-2.5 text-body text-muted"><Trans>No agents in this project.</Trans></div>
          ) : agents.map(a => {
            const active = a.id === selectedAgentId;
            return (
              <RowButton
                key={a.id}
                role="option"
                aria-selected={active}
                onClick={() => { onPick(a.id); setOpen(false); }}
                data-testid={`agent-picker-option-${a.id}`}
                className="flex items-center gap-2.5 px-2.5 py-1.5 transition-colors hover:bg-card"
                style={active ? { background: 'var(--accent-subtle)' } : undefined}
              >
                <AgentAvatar seed={a.id} label={a.name} size={26} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-body truncate', active ? 'text-primary font-semibold' : 'text-secondary')}>{a.name}</div>
                  <div className="text-caption text-muted truncate mono">{a.endpointName}</div>
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
