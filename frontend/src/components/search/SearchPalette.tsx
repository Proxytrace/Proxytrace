import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../overlays/Modal';
import { searchApi, type SearchHit, type SearchKind } from '../../api/search';
import { QUERY_KEYS } from '../../api/query-keys';
import { SearchResultGroup } from './SearchResultGroup';
import { searchHitToHref } from '../../lib/search-routes';
import { SearchIcon } from '../icons';

interface Props {
  projectId: string;
  onClose: () => void;
}

const groupOrder: { kind: SearchKind; label: string }[] = [
  { kind: 'agent', label: 'Agents' },
  { kind: 'testSuite', label: 'Test Suites' },
  { kind: 'agentCall', label: 'Traces' },
  { kind: 'evaluator', label: 'Evaluators' },
];

export function SearchPalette({ projectId, onClose }: Props) {
  const [raw, setRaw] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(raw.trim()), 200);
    return () => clearTimeout(handle);
  }, [raw]);

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

  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { setActiveIndex(0); }, [debounced]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = flat[activeIndex];
      if (hit) {
        navigate(searchHitToHref(hit));
        onClose();
      }
    }
  }

  let cursor = 0;

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex flex-col gap-3 -m-4">
        <div className="border-b border-white/10 px-4 py-3 flex items-center gap-2">
          <SearchIcon size={14} />
          <input
            ref={inputRef}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search agents, suites, traces, evaluators…"
            className="flex-1 bg-transparent outline-none text-sm placeholder-white/40"
          />
          <kbd className="px-[6px] py-[1px] bg-white/10 rounded text-[10px] font-mono text-white/60">esc</kbd>
        </div>
        <div className="px-2 pb-2 max-h-[60vh] overflow-y-auto">
          {!enabled && (
            <div className="px-3 py-6 text-xs text-white/40">Type at least 2 characters.</div>
          )}
          {enabled && isFetching && hits.length === 0 && (
            <div className="px-3 py-6 text-xs text-white/40">Searching…</div>
          )}
          {enabled && !isFetching && hits.length === 0 && (
            <div className="px-3 py-6 text-xs text-white/40">No matches for &ldquo;{debounced}&rdquo;.</div>
          )}
          {groupOrder.map(g => {
            const groupHits = grouped.get(g.kind) ?? [];
            const startIndex = cursor;
            cursor += groupHits.length;
            return (
              <SearchResultGroup
                key={g.kind}
                label={g.label}
                hits={groupHits}
                activeIndex={activeIndex}
                startIndex={startIndex}
                onHover={setActiveIndex}
                onSelect={onClose}
              />
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
