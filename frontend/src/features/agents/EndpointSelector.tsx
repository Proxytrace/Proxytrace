import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../../api/agents';
import { providersApi } from '../../api/providers';
import type { AgentDto } from '../../api/models';
import { ChevronDownIcon } from '../../components/icons';
import useToast from '../../hooks/useToast';
import { modelColor } from '../../lib/colors';

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
  });

  const c = modelColor(agent.endpointName);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        data-write
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-body-sm font-medium transition-[background-color] duration-100 cursor-pointer"
        style={{
          background: `color-mix(in srgb, ${c} 12%, transparent)`,
          color: c,
          border: `1px solid color-mix(in srgb, ${c} 28%, transparent)`,
        }}
      >
        <span className="font-mono truncate max-w-[200px]">{agent.endpointName}</span>
        <ChevronDownIcon size={10} />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 rounded-lg overflow-hidden bg-surface-2 border border-hairline shadow-[var(--shadow-float)]"
          style={{ top: '100%', left: 0, minWidth: 220 }}
        >
          {endpoints.length === 0 && (
            <div className="px-4 py-3 text-body text-muted">Loading…</div>
          )}
          {endpoints.map(ep => {
            const isCurrent = ep.id === agent.endpointId;
            const ec = modelColor(ep.modelName);
            return (
              <button
                key={ep.id}
                onClick={() => !isCurrent && mutation.mutate(ep.id)}
                disabled={mutation.isPending}
                className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 transition-[background-color] duration-100 border-0 border-b border-hairline last:border-b-0 ${
                  !isCurrent ? 'hover:bg-[var(--bg-wash-hover)] cursor-pointer' : 'cursor-default'
                }`}
                style={
                  isCurrent ? { background: `color-mix(in srgb, ${ec} 10%, transparent)` } : undefined
                }
              >
                <span
                  className="text-body font-semibold font-mono"
                  style={{ color: isCurrent ? ec : 'var(--text-primary)' }}
                >
                  {ep.modelName}
                </span>
                <span className="text-body-sm text-muted">{ep.providerName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
