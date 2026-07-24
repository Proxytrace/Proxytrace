import { Plural, Trans } from '@lingui/react/macro';
import { cn } from '../../../../lib/cn';
import { RowButton } from '../../../../components/ui/RowButton';
import { detectorColor } from '../../../../lib/colors';
import { selectionRowStyle, selectionBarStyle, SELECTION_ROW_INACTIVE } from '../../../../lib/selectionRow';
import type { CustomAnomalyDetectorDto } from '../../../../api/models';

interface Props {
  detector: CustomAnomalyDetectorDto;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/** A single detector entry in the left rail. */
export function DetectorRow({ detector: d, isSelected, onSelect }: Props) {
  const color = detectorColor(d.id);
  return (
    <RowButton
      onClick={() => onSelect(d.id)}
      data-testid={`detector-rail-item-${d.id}`}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors',
        !isSelected && SELECTION_ROW_INACTIVE,
      )}
      style={isSelected ? selectionRowStyle(color) : undefined}
    >
      <span
        className="w-[3px] self-stretch shrink-0"
        style={isSelected ? selectionBarStyle(color) : undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn('w-1.5 h-1.5 rounded-full shrink-0', d.isEnabled ? 'bg-success' : 'bg-muted')}
            aria-hidden
          />
          <span className="text-body font-semibold text-primary truncate" data-testid={`detector-name-${d.id}`}>
            {d.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-caption text-muted font-mono">
          <span className="truncate">{d.endpointName}</span>
          <span className="opacity-40">·</span>
          <span className="shrink-0"><Plural value={d.triggers.length} one="# trigger" other="# triggers" /></span>
          {d.blockUpstream && (
            <>
              <span className="opacity-40">·</span>
              <span className="shrink-0 text-danger font-sans"><Trans>Blocking</Trans></span>
            </>
          )}
        </div>
      </div>
      {!d.isEnabled && <span className="text-caption text-muted shrink-0"><Trans>Off</Trans></span>}
    </RowButton>
  );
}
