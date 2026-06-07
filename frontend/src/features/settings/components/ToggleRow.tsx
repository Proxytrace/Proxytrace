import { Switch } from '../../../components/ui/Switch';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId?: string;
}

export function ToggleRow({ label, description, checked, onChange, testId }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4" data-testid={testId}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-semibold text-primary">{label}</span>
        <span className="text-[12px] text-muted">{description}</span>
      </div>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}
