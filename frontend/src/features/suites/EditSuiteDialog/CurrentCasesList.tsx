import type { TestCaseDto } from '../../../api/models';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { XIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { lastUserSnippet } from '../suitesMeta';

interface Props {
  cases: TestCaseDto[];
  pendingRemoveCaseIds: Set<string>;
  selectedCaseId: string | null;
  onSelectCase: (id: string) => void;
  onToggleRemove: (id: string) => void;
  empty: boolean;
  searched: boolean;
}

export function CurrentCasesList({
  cases, pendingRemoveCaseIds, selectedCaseId, onSelectCase, onToggleRemove, empty, searched,
}: Props) {
  if (empty) {
    return <EmptyState title="No test cases" description="Switch to Add from traces to seed this suite." />;
  }
  if (cases.length === 0 && searched) {
    return <EmptyState title="No matches" description="Clear the search to see all cases." />;
  }
  return (
    <ul className="flex flex-col">
      {cases.map(tc => {
        const removing = pendingRemoveCaseIds.has(tc.id);
        const selected = selectedCaseId === tc.id;
        const snippet = lastUserSnippet(tc.input).slice(0, 120);
        return (
          <li
            key={tc.id}
            onClick={() => onSelectCase(tc.id)}
            className={cn(
              'cursor-pointer transition-colors duration-100',
              'px-3 py-2.5 border-l-[3px] border-b border-b-hairline',
              selected ? 'border-l-accent bg-accent-subtle' : 'border-l-transparent',
              removing && 'opacity-55',
            )}
          >
            <div className="flex items-center gap-2">
              <ColoredBadge color="var(--teal)" label={`${tc.input.length} msg`} size="sm" />
              <span
                className={cn(
                  'text-[12.5px] truncate min-w-0 flex-1',
                  removing ? 'line-through text-muted' : 'text-primary',
                )}
              >
                {snippet || <span className="text-muted italic">No user message</span>}
              </span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggleRemove(tc.id); }}
                className={removing ? 'text-[11px] text-accent font-semibold cursor-pointer bg-transparent border-0 shrink-0' : 'btn-icon btn-icon-danger shrink-0'}
                title={removing ? 'Undo remove' : 'Remove'}
              >
                {removing ? 'Undo' : <XIcon size={12} />}
              </button>
            </div>
            {removing && (
              <div className="mt-[3px] text-[10.5px] text-warn font-semibold uppercase tracking-[0.08em]">Pending removal</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
