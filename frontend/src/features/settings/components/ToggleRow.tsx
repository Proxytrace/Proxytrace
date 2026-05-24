import { cn } from '../../../lib/cn';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-semibold text-primary">{label}</span>
        <span className="text-[12px] text-muted">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative shrink-0 w-10 h-6 rounded-full transition-colors cursor-pointer',
          checked ? 'bg-[image:var(--grad-accent)]' : 'bg-card-2 border border-hairline',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </label>
  );
}
