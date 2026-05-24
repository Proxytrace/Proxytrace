/**
 * Manages the "load from trace / test case" seed dropdown:
 * open/close state + document-level mousedown + keydown listeners that close it
 * when clicking outside or pressing Escape.
 *
 * This is a genuine external DOM subscription (§4 decision table: DOM events).
 */
import { useEffect, useRef, useState } from 'react';

interface UseSeedDropdownResult {
  showSeed: boolean;
  setShowSeed: React.Dispatch<React.SetStateAction<boolean>>;
  seedAnchorRef: React.RefObject<HTMLDivElement | null>;
}

export function useSeedDropdown(): UseSeedDropdownResult {
  const [showSeed, setShowSeed] = useState(false);
  const seedAnchorRef = useRef<HTMLDivElement | null>(null);

  // Effect 5 resolution: document mousedown + keydown listeners to close the seed
  // dropdown. Legitimate external DOM subscription — no Query/memo equivalent.
  useEffect(() => {
    if (!showSeed) return;
    function onDocClick(e: MouseEvent) {
      if (!seedAnchorRef.current) return;
      if (!seedAnchorRef.current.contains(e.target as Node)) setShowSeed(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowSeed(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showSeed]);

  return { showSeed, setShowSeed, seedAnchorRef };
}
