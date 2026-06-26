import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLingui } from '@lingui/react/macro';
import { IconButton } from '../../../components/ui/Button';
import { XIcon, ChevronRightIcon } from '../../../components/icons';
import { ID_SHORT_LEN } from '../../../lib/constants';
import { useDrawerKeys } from './useDrawerKeys';

/** Identity + position of the case a drawer is showing (for the title + "i/N" counter). */
export interface DrawerCase {
  id: string;
  summary?: string;
  /** 0-based position within the filtered list. */
  idx?: number;
  total?: number;
}

/** Close + prev/next handlers for the drawer's case navigation. */
export interface DrawerNav {
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

interface Props {
  /** Tailwind width classes for the sliding panel. */
  widthClass: string;
  caseInfo: DrawerCase;
  nav: DrawerNav;
  /** Left-of-title slot (e.g. pass/fail dot or a "N models" badge). */
  leading?: ReactNode;
  /** Right-of-title slot before the index counter (e.g. a PASS/FAIL pill). */
  trailing?: ReactNode;
  /** Content below the sticky header — owns its own scroll/shrink layout. */
  children: ReactNode;
}

/**
 * Portal + backdrop + right-side sliding panel with a sticky header (case id,
 * summary, index counter, prev/next/close nav). Used by ComparisonDrawer;
 * keyboard nav handled by useDrawerKeys.
 */
export function DrawerShell({ widthClass, caseInfo, nav, leading, trailing, children }: Props) {
  const { t } = useLingui();
  const { onClose, onPrev, onNext } = nav;
  useDrawerKeys(nav);

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
                {caseInfo.id.slice(0, ID_SHORT_LEN)}
              </span>
              <span className="text-h2 font-semibold truncate">{caseInfo.summary ?? t`Test Case`}</span>
            </div>
          </div>

          {trailing}

          {caseInfo.idx != null && caseInfo.total != null && (
            <span className="text-body-sm text-muted shrink-0">{caseInfo.idx + 1}/{caseInfo.total}</span>
          )}

          <div className="flex gap-[3px] shrink-0">
            <IconButton size="sm" onClick={onPrev} disabled={!onPrev} aria-label={t`Previous case`} className="disabled:opacity-30">
              <ChevronRightIcon size={14} className="rotate-180" />
            </IconButton>
            <IconButton size="sm" onClick={onNext} disabled={!onNext} aria-label={t`Next case`} className="disabled:opacity-30">
              <ChevronRightIcon size={14} />
            </IconButton>
          </div>

          <IconButton onClick={onClose} aria-label={t`Close`}><XIcon size={14} /></IconButton>
        </div>

        {children}
      </div>
    </>,
    document.body,
  );
}
