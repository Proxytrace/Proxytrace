import { ChevronDownIcon } from '../icons';

interface FilterChipProps {
  label: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
  accent?: string;
}

export function FilterChip({ label, value, active, onClick, accent }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-[6px] px-[10px] py-[6px] rounded-[8px] text-[12px] font-medium whitespace-nowrap cursor-pointer ${active ? 'bg-card-2 text-primary' : 'bg-card text-secondary'}`}
      style={{ boxShadow: active ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.3)' : 'var(--shadow-pill)' }}
    >
      {accent && <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: accent }} />}
      <span className="text-muted font-medium">{label}</span>
      <span>{value}</span>
      <ChevronDownIcon size={12} strokeWidth={2.5} className="text-muted ml-[2px]" />
    </button>
  );
}
