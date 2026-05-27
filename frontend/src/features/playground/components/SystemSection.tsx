import { formInputCls } from '../../../components/ui/classes';
import type { PlaygroundOverrides } from '../state/types';

interface SystemSectionProps {
  overrides: PlaygroundOverrides;
  defaultSystemPrompt?: string;
  systemPromptModified: boolean;
  onChange: (next: PlaygroundOverrides) => void;
}

export function SystemSection({ overrides, defaultSystemPrompt, systemPromptModified, onChange }: SystemSectionProps) {
  return (
    <div className="flex flex-col gap-[6px]">
      <textarea
        className={`${formInputCls} resize-y mono text-[12px]`}
        rows={10}
        value={overrides.systemPrompt}
        onChange={e => onChange({ ...overrides, systemPrompt: e.target.value })}
        placeholder="System instructions sent to the agent"
        aria-label="System prompt"
      />
      <div className="flex justify-between text-[10.5px] text-muted mono">
        <span>{overrides.systemPrompt.length} chars</span>
        {systemPromptModified && defaultSystemPrompt != null && (
          <button
            type="button"
            onClick={() => onChange({ ...overrides, systemPrompt: defaultSystemPrompt })}
            className="text-accent hover:text-accent-hover transition-colors cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
