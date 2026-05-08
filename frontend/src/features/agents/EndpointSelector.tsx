import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../../api/agents';
import { providersApi } from '../../api/providers';
import type { AgentDto } from '../../api/models';
import { ChevronDownIcon } from '../../components/icons';
import { useToast } from '../../components/ui/Toast';

export function EndpointSelector({ agent }: { agent: AgentDto }) {
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
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'agents' });
      setOpen(false);
      toast('Endpoint updated', 'success');
    },
    onError: (err) => toast((err as Error).message || 'Failed to update endpoint', 'error'),
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-[6px] px-[10px] py-[5px] rounded-lg text-[11.5px] font-medium transition-[background] duration-100 cursor-pointer"
        style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}
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
                className={`w-full text-left px-4 py-[10px] flex flex-col gap-[2px] transition-[background] duration-100${!isCurrent ? ' hover:bg-[var(--bg-card-hover,rgba(255,255,255,0.04))] cursor-pointer' : ''}`}
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
