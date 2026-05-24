import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { searchApi, type SearchHit, type SearchKind } from '../../api/search';
import { QUERY_KEYS } from '../../api/query-keys';
import { searchHitToHref } from '../../lib/search-routes';
import {
  SearchIcon, UsersIcon, CheckboxIcon, ActivityIcon, ScaleIcon,
} from '../icons';
import { SearchPreview } from './SearchPreview';

const ALL_GROUPS: { kind: SearchKind; label: string }[] = [
  { kind: 'agent', label: 'Agents' },
  { kind: 'testSuite', label: 'Test Suites' },
  { kind: 'agentCall', label: 'Traces' },
  { kind: 'testCase', label: 'Test Cases' },
  { kind: 'evaluator', label: 'Evaluators' },
];

const KIND_META: Record<SearchKind, { label: string; accent: string; icon: (s: number) => React.ReactNode }> = {
  agent:     { label: 'Agent',      accent: 'var(--teal)',           icon: s => <UsersIcon size={s} /> },
  testSuite: { label: 'Test Suite', accent: 'var(--success)',        icon: s => <CheckboxIcon size={s} /> },
  agentCall: { label: 'Trace',      accent: 'var(--accent-primary)', icon: s => <ActivityIcon size={s} /> },
  evaluator: { label: 'Evaluator',  accent: 'var(--warn)',           icon: s => <ScaleIcon size={s} /> },
  testCase:  { label: 'Test Case',  accent: 'var(--success)',        icon: s => <CheckboxIcon size={s} /> },
};

export interface UnifiedSearchHandle {
  focus: () => void;
}

interface Props {
  projectId: string;
  kinds?: SearchKind[];
  onSelect?: (hit: SearchHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
  width?: 'auto' | 'fixed';
  showRecents?: boolean;
  recentLimit?: number;
  className?: string;
  showShortcut?: boolean;
}

export const UnifiedSearch = forwardRef<UnifiedSearchHandle, Props>(function UnifiedSearch({
  projectId,
  kinds,
  onSelect,
  placeholder = 'Search traces, agents, suites…',
  autoFocus = false,
  width = 'fixed',
  showRecents = true,
  recentLimit = 6,
  className = '',
  showShortcut = true,
}, ref) {
  const [raw, setRaw] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }), []);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebounced(raw.trim());
      setActiveIndex(0);
    }, 180);
    return () => clearTimeout(handle);
  }, [raw]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const groupOrder = useMemo(
    () => kinds && kinds.length > 0
      ? ALL_GROUPS.filter(g => kinds.includes(g.kind))
      : ALL_GROUPS.filter(g => g.kind !== 'testCase'),
    [kinds],
  );

  const allowedKinds = useMemo(() => new Set(groupOrder.map(g => g.kind)), [groupOrder]);
  const recentKinds = useMemo(() => groupOrder.map(g => g.kind), [groupOrder]);

  const searchEnabled = debounced.length >= 2;
  const searchQuery = useQuery({
    queryKey: QUERY_KEYS.search(projectId, debounced),
    queryFn: () => searchApi.search(projectId, debounced),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  const recentEnabled = showRecents && open && debounced.length === 0;
  const recentQuery = useQuery({
    queryKey: QUERY_KEYS.searchRecent(projectId, recentKinds, recentLimit),
    queryFn: () => searchApi.recent(projectId, recentKinds, recentLimit),
    enabled: recentEnabled,
    staleTime: 15_000,
    retry: false,
  });

  const isRecentMode = debounced.length === 0;
  const sourceHits = useMemo<SearchHit[]>(() => {
    if (isRecentMode) return recentQuery.data?.hits ?? [];
    return searchQuery.data?.hits ?? [];
  }, [isRecentMode, recentQuery.data, searchQuery.data]);

  const hits = useMemo(
    () => sourceHits.filter(h => allowedKinds.has(h.kind)),
    [sourceHits, allowedKinds],
  );

  const grouped = useMemo(() => {
    const m = new Map<SearchKind, SearchHit[]>();
    for (const h of hits) {
      const arr = m.get(h.kind) ?? [];
      arr.push(h);
      m.set(h.kind, arr);
    }
    return m;
  }, [hits]);

  const flat = useMemo(
    () => groupOrder.flatMap(g => grouped.get(g.kind) ?? []),
    [grouped, groupOrder],
  );

  const groupOffsets = useMemo(() => {
    const offsets = new Map<SearchKind, number>();
    let c = 0;
    for (const g of groupOrder) {
      offsets.set(g.kind, c);
      c += (grouped.get(g.kind) ?? []).length;
    }
    return offsets;
  }, [grouped, groupOrder]);

  const activeHit = flat[activeIndex];

  function close() {
    setOpen(false);
    inputRef.current?.blur();
  }

  function commit(hit: SearchHit) {
    if (onSelect) {
      onSelect(hit);
    } else {
      navigate(searchHitToHref(hit));
    }
    setRaw('');
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = flat[activeIndex];
      if (hit) commit(hit);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (raw) setRaw('');
      else close();
    }
  }

  const showDropdown = open;
  const fetching = isRecentMode ? recentQuery.isFetching : searchQuery.isFetching;
  const recentErrored = isRecentMode && recentQuery.isError;

  const dropdownWidthCls = width === 'fixed'
    ? 'left-1/2 -translate-x-1/2 w-[720px] max-w-[calc(100vw-40px)]'
    : 'left-0 right-0';

  const wrapperWidthCls = width === 'fixed' ? 'flex-1 max-w-[460px] mx-auto' : 'w-full';
  const inputBgCls = width === 'fixed' ? 'bg-white/[.03]' : 'bg-card-2';

  return (
    <div ref={wrapperRef} className={`relative ${wrapperWidthCls} ${className}`}>
      <div className={`flex items-center gap-2 px-3 py-[7px] rounded-[10px] text-[13px] ${inputBgCls} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)] focus-within:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-primary)_40%,transparent),0_1px_2px_rgba(0,0,0,0.2)] transition-shadow`}>
        <SearchIcon size={14} />
        <input
          ref={inputRef}
          value={raw}
          autoFocus={autoFocus}
          onChange={e => { setRaw(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[13px] placeholder-white/40 text-white"
        />
        {raw ? (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setRaw(''); inputRef.current?.focus(); }}
            className="text-white/40 hover:text-white/80 text-[11px] cursor-pointer"
            aria-label="Clear search"
          >
            ✕
          </button>
        ) : showShortcut ? (
          <span className="flex gap-[3px]">
            <kbd className="px-[6px] py-[1px] bg-card-2 rounded text-[10px] font-mono">⌘</kbd>
            <kbd className="px-[6px] py-[1px] bg-card-2 rounded text-[10px] font-mono">K</kbd>
          </span>
        ) : null}
      </div>

      {showDropdown && (
        <div className={`absolute top-[calc(100%+8px)] ${dropdownWidthCls} rounded-[14px] bg-[rgba(24,24,28,0.96)] backdrop-blur-[20px] backdrop-saturate-[140%] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)] z-50 overflow-hidden`}>
          {!isRecentMode && !searchEnabled && (
            <div className="px-4 py-6 text-xs text-white/40">Type at least 2 characters.</div>
          )}
          {!isRecentMode && searchEnabled && fetching && hits.length === 0 && (
            <div className="px-4 py-6 text-xs text-white/40 flex items-center gap-2">
              <span className="size-[6px] rounded-full bg-accent pulse-dot" />
              Searching…
            </div>
          )}
          {!isRecentMode && searchEnabled && !fetching && hits.length === 0 && (
            <div className="px-4 py-6 text-xs text-white/40">No matches for &ldquo;{debounced}&rdquo;.</div>
          )}
          {isRecentMode && fetching && hits.length === 0 && !recentErrored && (
            <div className="px-4 py-6 text-xs text-white/40">Loading recent…</div>
          )}
          {isRecentMode && !fetching && !recentErrored && hits.length === 0 && (
            <div className="px-4 py-6 text-xs text-white/40">No recent items.</div>
          )}
          {isRecentMode && recentErrored && (
            <div className="px-4 py-6 text-xs text-white/40">
              Type at least 2 characters to search.
            </div>
          )}

          {hits.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] h-[60vh] min-h-[280px]">
              <div className="min-h-0 overflow-y-auto py-2 border-r border-white/[.06]">
                {isRecentMode && (
                  <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                    Recent
                  </div>
                )}
                {groupOrder.map(g => {
                  const groupHits = grouped.get(g.kind) ?? [];
                  if (groupHits.length === 0) return null;
                  const meta = KIND_META[g.kind];
                  const startIndex = groupOffsets.get(g.kind) ?? 0;
                  return (
                    <div key={g.kind} className="mb-2">
                      {!isRecentMode && (
                        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                          <span style={{ color: meta.accent }}>{meta.icon(11)}</span>
                          {g.label}
                          <span className="text-white/25">· {groupHits.length}</span>
                        </div>
                      )}
                      <div className="flex flex-col px-1.5">
                        {groupHits.map((hit, i) => {
                          const globalIndex = startIndex + i;
                          const active = globalIndex === activeIndex;
                          const itemCls = `flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer text-left ${active ? 'bg-white/[.08]' : 'hover:bg-white/[.04]'}`;
                          const content = (
                            <>
                              <span
                                className="size-[22px] rounded-md flex items-center justify-center shrink-0"
                                style={{ background: `${meta.accent}1f`, color: meta.accent }}
                              >
                                {meta.icon(12)}
                              </span>
                              <span className="text-[13px] text-white truncate flex-1">{hit.title}</span>
                              {active && (
                                <kbd className="px-[5px] py-[1px] bg-white/10 rounded text-[10px] font-mono text-white/60">↵</kbd>
                              )}
                            </>
                          );
                          return onSelect ? (
                            <button
                              key={`${hit.kind}-${hit.entityId}`}
                              type="button"
                              onMouseEnter={() => setActiveIndex(globalIndex)}
                              onClick={() => commit(hit)}
                              className={itemCls}
                            >
                              {content}
                            </button>
                          ) : (
                            <Link
                              key={`${hit.kind}-${hit.entityId}`}
                              to={searchHitToHref(hit)}
                              onMouseEnter={() => setActiveIndex(globalIndex)}
                              onClick={() => { setRaw(''); close(); }}
                              className={itemCls}
                            >
                              {content}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="min-h-0 overflow-y-auto p-4">
                {activeHit ? (
                  <SearchPreview key={`${activeHit.kind}-${activeHit.entityId}`} hit={activeHit} />
                ) : (
                  <div className="text-xs text-white/40">Hover or arrow to preview.</div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-white/[.06] px-4 py-2 flex items-center gap-4 text-[11px] text-white/40 bg-black/20">
            <span className="flex items-center gap-1.5"><kbd className="px-[5px] py-[1px] bg-white/10 rounded font-mono text-[10px]">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1.5"><kbd className="px-[5px] py-[1px] bg-white/10 rounded font-mono text-[10px]">↵</kbd> {onSelect ? 'pick' : 'open'}</span>
            <span className="flex items-center gap-1.5"><kbd className="px-[5px] py-[1px] bg-white/10 rounded font-mono text-[10px]">esc</kbd> close</span>
            <span className="ml-auto">{hits.length > 0 ? `${hits.length} ${isRecentMode ? 'recent' : `result${hits.length === 1 ? '' : 's'}`}` : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
});

