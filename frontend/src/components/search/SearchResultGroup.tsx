import type { SearchHit } from '../../api/search';
import { SearchResultRow } from './SearchResultRow';

interface Props {
  label: string;
  hits: SearchHit[];
  activeIndex: number;
  startIndex: number;
  onHover: (globalIndex: number) => void;
  onSelect: () => void;
}

export function SearchResultGroup({ label, hits, activeIndex, startIndex, onHover, onSelect }: Props) {
  if (hits.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="flex flex-col">
        {hits.map((hit, i) => {
          const globalIndex = startIndex + i;
          return (
            <SearchResultRow
              key={`${hit.kind}-${hit.entityId}`}
              hit={hit}
              active={globalIndex === activeIndex}
              onHover={() => onHover(globalIndex)}
              onClick={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
