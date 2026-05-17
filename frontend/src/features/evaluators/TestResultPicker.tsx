import { useEffect, useRef, useState } from 'react';
import type { SearchHit } from '../../api/search';
import { UnifiedSearch } from '../../components/search/UnifiedSearch';

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
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card text-left text-[12.5px] text-primary cursor-pointer transition-colors hover:bg-card-2"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={projectId == null}
      >
        <SearchIcon />
        <span className={`flex-1 truncate ${selectedLabel ? 'text-primary' : 'text-muted'}`}>
          {selectedLabel ?? (projectId == null ? 'Pick a project first.' : 'Search a past test result…')}
        </span>
        <span className="text-muted text-[10px]">▾</span>
      </button>

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

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
