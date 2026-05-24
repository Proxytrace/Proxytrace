import type { SearchHit } from '../../api/search';
import { MetaGrid } from './SearchPreviewPrimitives';

interface GenericBodyProps {
  hit: SearchHit;
}

/** Fallback preview body: renders the hit's snippet and any metadata key/value pairs. */
export function GenericBody({ hit }: GenericBodyProps) {
  const entries = Object.entries(hit.metadata ?? {});
  return (
    <>
      {hit.snippet && (
        <div
          className="text-[12px] text-white/70 leading-relaxed break-words [&_mark]:bg-accent/30 [&_mark]:text-accent-hover [&_mark]:rounded [&_mark]:px-[3px] [&_mark]:py-[1px] [&_mark]:font-medium"
          dangerouslySetInnerHTML={{ __html: hit.snippet }}
        />
      )}
      {entries.length > 0 && <MetaGrid entries={entries as [string, string][]} />}
    </>
  );
}
