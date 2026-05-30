import type { ModelSwitchDetailsDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { modelColor } from '../../../lib/colors';

interface ModelBoxProps {
  label: string;
  name: string;
  color: string;
  tint: string;
}

function ModelBox({ label, name, color, tint }: ModelBoxProps) {
  return (
    <div
      className="rounded-md text-center min-w-[160px] px-4 py-2.5"
      style={{ background: tint }}
    >
      <div
        className={cn(
          'text-caption font-semibold uppercase tracking-[0.07em] mb-1',
          label === 'To' ? 'text-success' : 'text-muted',
        )}
      >
        {label}
      </div>
      <div className="mono text-h2 font-bold" style={{ color }}>{name}</div>
    </div>
  );
}

interface Props {
  details: ModelSwitchDetailsDto;
}

export function ModelSwitchSection({ details }: Props) {
  const fromColor = modelColor(details.currentModelName);
  const toColor = modelColor(details.proposedModelName);

  return (
    <div className="bg-[rgba(0,0,0,0.4)] rounded-md overflow-hidden border border-border-subtle" data-testid="model-switch-section">
      <div className="px-3.5 py-2 border-b border-hairline bg-card-2/30">
        <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em]">Model change</span>
      </div>
      <div className="flex items-center gap-3.5 justify-center px-3.5 py-4">
        <ModelBox
          label="From"
          name={details.currentModelName}
          color={fromColor}
          tint="color-mix(in srgb, var(--danger) 6%, transparent)"
        />
        <span className="text-h2 text-muted">→</span>
        <ModelBox
          label="To"
          name={details.proposedModelName}
          color={toColor}
          tint="color-mix(in srgb, var(--success) 6%, transparent)"
        />
      </div>
    </div>
  );
}
