import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, ChevronRightIcon } from '../../../components/icons';
import { FOCUS_RING, ID_SHORT_LEN } from '../../../lib/constants';
import { useDrawerKeys } from './useDrawerKeys';

interface Props {
  /** Tailwind width classes for the sliding panel. */
  widthClass: string;
  caseId: string;
  caseSummary?: string;
  caseIdx?: number;
  total?: number;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** Left-of-title slot (e.g. pass/fail dot or a "N models" badge). */
  leading?: ReactNode;
  /** Right-of-title slot before the index counter (e.g. a PASS/FAIL pill). */
  trailing?: ReactNode;
  /** Content below the sticky header — owns its own scroll/shrink layout. */
  children: ReactNode;
}

const NAV_BTN = 'w-7 h-7 rounded-md flex items-center justify-center text-secondary bg-card border border-border';

/**
 * Portal + backdrop + right-side sliding panel with a sticky header (case id,
 * summary, index counter, prev/next/close nav). Shared by FixtureDrawer and
 * ComparisonDrawer; keyboard nav handled by useDrawerKeys.
 */
export function DrawerShell({
  widthClass,
  caseId,
  caseSummary,
  caseIdx,
  total,
  onClose,
  onPrev,
  onNext,
  leading,
  trailing,
  children,
}: Props) {
  useDrawerKeys({ onClose, onPrev, onNext });

  return createPortal(
    <>
      <div className="fixed inset-0 z-[49] bg-black/[0.45]" onClick={onClose} />

      <div className={`fixed top-0 right-0 h-full flex flex-col bg-surface-2 border-l border-border z-50 fade-up shadow-[var(--shadow-float)] ${widthClass}`}>
        {/* Sticky header */}
        <div className="px-5 py-3.5 border-b border-hairline flex items-center gap-2.5 shrink-0 bg-surface-2">
          {leading}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="mono shrink-0 px-1.5 py-px rounded-sm bg-card-2 text-muted text-body-sm">
                {caseId.slice(0, ID_SHORT_LEN)}
              </span>
              <span className="text-h2 font-semibold truncate">{caseSummary ?? 'Test Case'}</span>
            </div>
          </div>

          {trailing}

          {caseIdx != null && total != null && (
            <span className="text-body-sm text-muted shrink-0">{caseIdx + 1}/{total}</span>
          )}

          <div className="flex gap-[3px] shrink-0">
            <button
              onClick={onPrev} disabled={!onPrev} aria-label="Previous case"
              className={`${NAV_BTN} ${onPrev ? `cursor-pointer ${FOCUS_RING}` : 'opacity-30 cursor-not-allowed'}`}
            ><ChevronRightIcon size={14} className="rotate-180" /></button>
            <button
              onClick={onNext} disabled={!onNext} aria-label="Next case"
              className={`${NAV_BTN} ${onNext ? `cursor-pointer ${FOCUS_RING}` : 'opacity-30 cursor-not-allowed'}`}
            ><ChevronRightIcon size={14} /></button>
          </div>

          <button onClick={onClose} className="btn-icon" aria-label="Close"><XIcon size={14} /></button>
        </div>

        {children}
      </div>
    </>,
    document.body,
  );
}
