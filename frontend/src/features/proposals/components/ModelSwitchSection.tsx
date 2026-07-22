import { Trans } from '@lingui/react/macro';
import type { ModelSwitchDetailsDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { modelColor } from '../../../lib/colors';

interface ModelBoxProps {
  label: 'From' | 'To';
  name: string;
  color: string;
  tint: string;
}

function ModelBox({ label, name, color, tint }: ModelBoxProps) {
  return (
    <div
      className="rounded-md text-center min-w-[160px] max-w-[45%] px-4 py-2.5"
      style={{ background: tint }}
    >
      <div
        className={cn(
          'text-caption font-semibold uppercase tracking-[0.07em] mb-1',
          label === 'To' ? 'text-success' : 'text-muted',
        )}
      >
        {label === 'To' ? <Trans>To</Trans> : <Trans>From</Trans>}
      </div>
      <div className="mono text-h2 font-bold truncate" style={{ color }} title={name}>{name}</div>
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
    <div className="bg-black/40 rounded-md overflow-hidden border border-border-subtle" data-testid="model-switch-section">
      <div className="px-3.5 py-2 border-b border-hairline bg-card-2/30">
        <span className="text-caption text-secondary font-semibold uppercase tracking-[0.07em]"><Trans>Model change</Trans></span>
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
