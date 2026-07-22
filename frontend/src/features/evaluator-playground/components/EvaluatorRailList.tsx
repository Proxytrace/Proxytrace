import { useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { evaluatorColor } from '../../../lib/colors';
import { selectionRowStyle, selectionBarStyle, SELECTION_ROW_INACTIVE } from '../../../lib/selectionRow';
import type { EvaluatorListItemDto } from '../../../api/models';
import { RowButton } from '../../../components/ui/RowButton';
import { RailMonogram } from './RailMonogram';
import { KIND_LABEL } from '../testBenchMeta';

interface Props {
  evaluators: EvaluatorListItemDto[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Step-1 rail list: every evaluator as a selectable monogram row. */
export function EvaluatorRailList({ evaluators, selectedId, onSelect }: Props) {
  const { i18n } = useLingui();
  return (
    <div data-testid="evaluator-rail-list" className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 pr-1">
      {evaluators.map(ev => {
        const on = ev.id === selectedId;
        const color = evaluatorColor(ev.kind);
        return (
          <RowButton
            key={ev.id}
            data-testid={`evaluator-rail-row-${ev.id}`}
            aria-pressed={on}
            onClick={() => onSelect(ev.id)}
            className={cn(
              'relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left overflow-hidden transition-[box-shadow,background-color]',
              !on && SELECTION_ROW_INACTIVE,
            )}
            style={on ? selectionRowStyle(color) : undefined}
          >
            {on && (
              <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-none" style={selectionBarStyle(color)} />
            )}
            <RailMonogram name={ev.name} kind={ev.kind} size={28} />
            <span className="flex-1 min-w-0">
              <span className={cn('block text-body font-semibold truncate', on ? 'text-primary' : 'text-secondary')}>
                {ev.name}
              </span>
              <span className="block text-caption text-muted mt-0.5">{i18n._(KIND_LABEL[ev.kind])}</span>
            </span>
            <span
              className="w-[7px] h-[7px] rounded-full shrink-0"
              style={on ? { background: color } : undefined}
            />
          </RowButton>
        );
      })}
    </div>
  );
}
