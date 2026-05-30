import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '../../../components/ui/Button';
import { MoreHorizontalIcon, PlayIcon, ActivityIcon, SparklesIcon } from '../../../components/icons';

interface Props {
  agentId: string;
}

interface MenuItem {
  label: string;
  icon: ReactNode;
  to: string;
}

export function AgentActionsMenu({ agentId }: Props) {
  const navigate = useNavigate();
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

  const items: MenuItem[] = [
    { label: 'Open in playground', icon: <PlayIcon size={13} />, to: `/playground?agentId=${agentId}` },
    { label: 'View traces', icon: <ActivityIcon size={13} />, to: `/traces?agentId=${agentId}` },
    { label: 'View proposals', icon: <SparklesIcon size={13} />, to: `/proposals?agentId=${agentId}` },
  ];

  return (
    <div className="relative" ref={ref}>
      <IconButton
        onClick={() => setOpen(v => !v)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="agent-actions-btn"
      >
        <MoreHorizontalIcon size={15} />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-1 min-w-[200px] rounded-lg overflow-hidden bg-surface-2 border border-hairline shadow-[var(--shadow-float)]"
        >
          {items.map(item => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(item.to);
              }}
              data-testid={`agent-action-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 text-body text-secondary hover:text-primary hover:bg-[var(--bg-wash-hover)] cursor-pointer transition-colors duration-100 border-b border-hairline last:border-b-0"
            >
              <span className="text-muted shrink-0">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
