import { useMemo } from 'react';
import type { SearchHit } from '../../api/search';
import { sanitizeSnippet } from '../../lib/sanitize';
import { MetaGrid } from './SearchPreviewPrimitives';

interface GenericBodyProps {
  hit: SearchHit;
}

/** Fallback preview body: renders the hit's snippet and any metadata key/value pairs. */
export function GenericBody({ hit }: GenericBodyProps) {
  const entries = Object.entries(hit.metadata ?? {});
  const safeSnippet = useMemo(() => sanitizeSnippet(hit.snippet ?? ''), [hit.snippet]);
  return (
    <>
      {safeSnippet && (
        <div
          className="text-[12px] text-white/70 leading-relaxed break-words [&_mark]:bg-accent/30 [&_mark]:text-accent-hover [&_mark]:rounded [&_mark]:px-[3px] [&_mark]:py-[1px] [&_mark]:font-medium"
          dangerouslySetInnerHTML={{ __html: safeSnippet }}
        />
      )}
      {entries.length > 0 && <MetaGrid entries={entries} />}
    </>
  );
}
