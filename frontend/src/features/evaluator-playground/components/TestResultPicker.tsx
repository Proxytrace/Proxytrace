import { useEffect, useRef, useState } from 'react';
import type { SearchHit } from '../../../api/search';
import { UnifiedSearch } from '../../../components/search/UnifiedSearch';
import { RowButton } from '../../../components/ui/RowButton';
import { SearchIcon } from '../../../components/icons';

interface Props {
  evaluatorId: string;
  projectId: string | null;
  selectedLabel: string | null;
  onSelect: (hit: SearchHit) => void;
}

export function TestResultPicker({ projectId, selectedLabel, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <RowButton
        onClick={() => setOpen(o => !o)}
        data-testid="test-result-picker"
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card text-[12.5px] text-primary transition-colors hover:bg-card-2"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={projectId == null}
      >
        <SearchIcon size={13} className="text-muted shrink-0" />
        <span className={`flex-1 truncate ${selectedLabel ? 'text-primary' : 'text-muted'}`}>
          {selectedLabel ?? (projectId == null ? 'Pick a project first.' : 'Search a past test result…')}
        </span>
        <span className="text-muted text-[10px]">▾</span>
      </RowButton>

      {open && projectId != null && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30">
          <UnifiedSearch
            projectId={projectId}
            kinds={['testCase']}
            width="auto"
            autoFocus
            showShortcut={false}
            placeholder="Search test cases…"
            recentLimit={3}
            onSelect={hit => { onSelect(hit); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}
