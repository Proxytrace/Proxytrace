import { useEffect, useRef, useState } from 'react';
import type { AgentDto } from '../../api/models';
import { ChevronDownIcon } from '../../components/icons';
import { modelColor } from '../../lib/colors';
import { useEndpointSwitcher } from './hooks/useEndpointSwitcher';

export function EndpointSelector({ agent }: { agent: AgentDto }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { endpoints, switchEndpoint, isSwitching } = useEndpointSwitcher({
    agent,
    enabled: open,
    onSuccess: () => setOpen(false),
  });

  // Legitimate external subscription (DOM event) per BEST_PRACTICES §4.1.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

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
          className="absolute top-full left-0 min-w-[220px] z-50 mt-1 rounded-lg overflow-hidden bg-surface-2 border border-hairline shadow-[var(--shadow-float)]"
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
                onClick={() => !isCurrent && switchEndpoint(ep.id)}
                disabled={isSwitching}
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
