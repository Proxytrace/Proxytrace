import { Link } from 'react-router-dom';
import type { SearchHit } from '../../api/search';
import { searchHitToHref } from '../../lib/search-routes';

interface Props {
  hit: SearchHit;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}

export function SearchResultRow({ hit, active, onHover, onClick }: Props) {
  return (
    <Link
      to={searchHitToHref(hit)}
      onMouseEnter={onHover}
      onClick={onClick}
      className={`block px-3 py-2 rounded-md ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
      data-active={active}
    >
      <div className="text-sm font-medium text-white truncate">{hit.title}</div>
      <div
        className="text-xs text-white/60 truncate [&_mark]:bg-yellow-300/30 [&_mark]:text-yellow-100 [&_mark]:rounded [&_mark]:px-0.5"
        dangerouslySetInnerHTML={{ __html: hit.snippet }}
      />
    </Link>
  );
}
