import type { PlaygroundOverrides } from '../state/types';

const REASONING_OPTIONS = [
  { value: null, label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

interface ReasoningEffortControlProps {
  overrides: PlaygroundOverrides;
  onChange: (next: PlaygroundOverrides) => void;
}

export function ReasoningEffortControl({ overrides, onChange }: ReasoningEffortControlProps) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="text-[10.5px] text-muted uppercase tracking-[0.06em] font-semibold">Reasoning effort</span>
      <div
        role="radiogroup"
        aria-label="Reasoning effort"
        className="inline-flex p-[2px] rounded-[10px] gap-[2px] bg-[rgba(0,0,0,0.18)] border border-border"
      >
        {REASONING_OPTIONS.map(opt => {
          const sel = (overrides.parameters.reasoningEffort ?? null) === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => onChange({
                ...overrides,
                parameters: { ...overrides.parameters, reasoningEffort: opt.value },
              })}
              className={[
                'flex-1 px-[10px] py-[5px] rounded-[8px] text-[11.5px] font-medium cursor-pointer transition-colors',
                sel
                  ? 'bg-accent-subtle text-[var(--accent-hover)] border border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)]'
                  : 'bg-transparent text-secondary border border-transparent',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
