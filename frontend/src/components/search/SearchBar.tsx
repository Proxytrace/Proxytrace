import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { searchApi, type SearchHit, type SearchKind } from '../../api/search';
import { QUERY_KEYS } from '../../api/query-keys';
import { searchHitToHref } from '../../lib/search-routes';
import {
  SearchIcon, UsersIcon, CheckboxIcon, ActivityIcon, ScaleIcon,
} from '../icons';

interface Props {
  projectId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const groupOrder: { kind: SearchKind; label: string }[] = [
  { kind: 'agent', label: 'Agents' },
  { kind: 'testSuite', label: 'Test Suites' },
  { kind: 'agentCall', label: 'Traces' },
  { kind: 'evaluator', label: 'Evaluators' },
];

const kindMeta: Record<SearchKind, { label: string; accent: string; icon: (s: number) => React.ReactNode }> = {
  agent:     { label: 'Agent',      accent: '#7aa2ff', icon: s => <UsersIcon size={s} /> },
  testSuite: { label: 'Test Suite', accent: '#3daa6f', icon: s => <CheckboxIcon size={s} /> },
  agentCall: { label: 'Trace',      accent: '#c9944a', icon: s => <ActivityIcon size={s} /> },
  evaluator: { label: 'Evaluator',  accent: '#b97aff', icon: s => <ScaleIcon size={s} /> },
  testCase:  { label: 'Test Case',  accent: '#3daa6f', icon: s => <CheckboxIcon size={s} /> },
};

export function SearchBar({ projectId, inputRef }: Props) {
  const [raw, setRaw] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(raw.trim()), 180);
    return () => clearTimeout(handle);
  }, [raw]);

  useEffect(() => { setActiveIndex(0); }, [debounced]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const enabled = debounced.length >= 2;
  const { data, isFetching } = useQuery({
    queryKey: QUERY_KEYS.search(projectId, debounced),
    queryFn: () => searchApi.search(projectId, debounced),
    enabled,
    staleTime: 30_000,
  });

  const hits = data?.hits ?? [];
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
    [grouped]
  );

  const activeHit = flat[activeIndex];

  function close() {
    setOpen(false);
    inputRef.current?.blur();
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
      if (hit) {
        navigate(searchHitToHref(hit));
        setRaw('');
        close();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (raw) setRaw('');
      else close();
    }
  }

  const showDropdown = open && (raw.length > 0);

  let cursor = 0;

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-[460px] mx-auto">
      <div className="flex items-center gap-2 px-3 py-[7px] rounded-[10px] text-[13px] bg-white/[.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)] focus-within:shadow-[inset_0_0_0_1px_rgba(201,148,74,0.4),0_1px_2px_rgba(0,0,0,0.2)] transition-shadow">
        <SearchIcon size={14} />
        <input
          ref={inputRef}
          value={raw}
          onChange={e => { setRaw(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search traces, agents, suites…"
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
        ) : (
          <span className="flex gap-[3px]">
            <kbd className="px-[6px] py-[1px] bg-card-2 rounded text-[10px] font-mono">⌘</kbd>
            <kbd className="px-[6px] py-[1px] bg-card-2 rounded text-[10px] font-mono">K</kbd>
          </span>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[720px] max-w-[calc(100vw-40px)] rounded-[14px] bg-[rgba(24,24,28,0.96)] backdrop-blur-[20px] backdrop-saturate-[140%] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)] z-50 overflow-hidden">
          {!enabled && (
            <div className="px-4 py-6 text-xs text-white/40">Type at least 2 characters.</div>
          )}
          {enabled && isFetching && hits.length === 0 && (
            <div className="px-4 py-6 text-xs text-white/40 flex items-center gap-2">
              <span className="size-[6px] rounded-full bg-accent pulse-dot" />
              Searching…
            </div>
          )}
          {enabled && !isFetching && hits.length === 0 && (
            <div className="px-4 py-6 text-xs text-white/40">No matches for &ldquo;{debounced}&rdquo;.</div>
          )}

          {enabled && hits.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-h-[280px] max-h-[60vh]">
              <div className="overflow-y-auto py-2 border-r border-white/[.06]">
                {groupOrder.map(g => {
                  const groupHits = grouped.get(g.kind) ?? [];
                  if (groupHits.length === 0) return null;
                  const meta = kindMeta[g.kind];
                  const startIndex = cursor;
                  cursor += groupHits.length;
                  return (
                    <div key={g.kind} className="mb-2">
                      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                        <span style={{ color: meta.accent }}>{meta.icon(11)}</span>
                        {g.label}
                        <span className="text-white/25">· {groupHits.length}</span>
                      </div>
                      <div className="flex flex-col px-1.5">
                        {groupHits.map((hit, i) => {
                          const globalIndex = startIndex + i;
                          const active = globalIndex === activeIndex;
                          return (
                            <Link
                              key={`${hit.kind}-${hit.entityId}`}
                              to={searchHitToHref(hit)}
                              onMouseEnter={() => setActiveIndex(globalIndex)}
                              onClick={() => { setRaw(''); close(); }}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer ${active ? 'bg-white/[.08]' : 'hover:bg-white/[.04]'}`}
                            >
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
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-y-auto p-4">
                {activeHit ? (
                  <PreviewPane hit={activeHit} />
                ) : (
                  <div className="text-xs text-white/40">Hover or arrow to preview.</div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-white/[.06] px-4 py-2 flex items-center gap-4 text-[11px] text-white/40 bg-black/20">
            <span className="flex items-center gap-1.5"><kbd className="px-[5px] py-[1px] bg-white/10 rounded font-mono text-[10px]">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1.5"><kbd className="px-[5px] py-[1px] bg-white/10 rounded font-mono text-[10px]">↵</kbd> open</span>
            <span className="flex items-center gap-1.5"><kbd className="px-[5px] py-[1px] bg-white/10 rounded font-mono text-[10px]">esc</kbd> close</span>
            <span className="ml-auto">{hits.length > 0 ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewPane({ hit }: { hit: SearchHit }) {
  const meta = kindMeta[hit.kind];
  const entries = Object.entries(hit.metadata ?? {});
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-wider font-semibold px-2 py-[3px] rounded-full"
          style={{ background: `${meta.accent}1f`, color: meta.accent }}
        >
          {meta.label}
        </span>
        <span className="text-[10px] text-white/30">
          score {hit.score.toFixed(2)}
        </span>
      </div>

      <div className="text-[15px] font-semibold text-white leading-snug break-words">{hit.title}</div>

      <div
        className="text-[12.5px] text-white/70 leading-relaxed break-words [&_mark]:bg-[#c9944a]/30 [&_mark]:text-[#f0d9a8] [&_mark]:rounded [&_mark]:px-[3px] [&_mark]:py-[1px] [&_mark]:font-medium"
        dangerouslySetInnerHTML={{ __html: hit.snippet }}
      />

      {entries.length > 0 && (
        <div className="mt-2 pt-3 border-t border-white/[.06] flex flex-col gap-1.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-3 text-[11.5px]">
              <span className="text-white/40 min-w-[80px] uppercase tracking-wider text-[10px]">{k}</span>
              <span className="text-white/80 truncate">{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3 text-[11px] text-white/40">
        Press <kbd className="px-[5px] py-[1px] bg-white/10 rounded font-mono text-[10px]">↵</kbd> to open
      </div>
    </div>
  );
}
