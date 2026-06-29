import { ChevronDownIcon } from '../icons';
import { cn } from '../../lib/cn';
import { FOCUS_RING } from '../../lib/constants';

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
      className={cn(
        'inline-flex items-center gap-1.75 h-9 px-2.75 rounded-md text-body font-medium',
        'whitespace-nowrap cursor-pointer border',
        'transition-[background,border-color,color] duration-[var(--motion-fast)] ease-[var(--ease-standard)]',
        FOCUS_RING,
        active
          ? 'bg-accent-subtle border-[var(--accent-border)] text-accent-text'
          : 'bg-card text-secondary border-border hover:bg-card-2',
      )}
    >
      {accent && <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: accent }} />}
      <span className={cn('font-medium', active ? 'text-accent' : 'text-muted')}>{label}</span>
      <span>{value}</span>
      <ChevronDownIcon
        size={12}
        strokeWidth={2.5}
        className={cn('ml-0.5', active ? 'text-accent-text' : 'text-muted')}
      />
    </button>
  );
}
