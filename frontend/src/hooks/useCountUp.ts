import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

/** Ease-out cubic — fast start, gentle settle. `t` and result are both 0–1. */
export function easeOutCubic(t: number): number {
  const c = 1 - t;
  return 1 - c * c * c;
}

/** Interpolate `from` → `to` at raw progress `p` (clamped to 0–1, eased). Pure. */
export function countUpValue(from: number, to: number, p: number): number {
  const clamped = p <= 0 ? 0 : p >= 1 ? 1 : p;
  return from + (to - from) * easeOutCubic(clamped);
}

/**
 * Animate a number from its previous value up to `target` over `durationMs`, the orchestrated
 * page-load reveal on the dashboard (DESIGN.md §2.6 — one entrance moment, no idle motion).
 *
 * Returns the current (possibly fractional) value — the caller rounds/formats for display. When
 * `target` changes mid-flight (e.g. an SSE-driven refetch) it tweens from wherever it is, so live
 * updates stay smooth rather than snapping. Honors `prefers-reduced-motion`: no animation, the
 * value is always `target`.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [display, setDisplay] = useState(0);
  // The value we're tweening *from* — tracks the last painted frame so a target change mid-flight
  // continues from the current position instead of jumping back to 0.
  const fromRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Reduced motion: skip the animation entirely — the return below reports `target` directly.
    if (reduce) return;
    const from = fromRef.current;
    if (from === target) return;

    let startTs: number | null = null;
    const tick = (now: number) => {
      if (startTs === null) startTs = now;
      const p = (now - startTs) / durationMs;
      const v = p >= 1 ? target : countUpValue(from, target, p);
      fromRef.current = v;
      setDisplay(v);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, reduce]);

  return reduce ? target : display;
}
