import { ChevronRightIcon, XIcon } from '../icons';
import { DetailPanel } from './DetailPanel';

interface DrawerProps {
  title?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  children: React.ReactNode;
  subtitle?: string;
}

/**
 * Convenience right-side detail drawer: the shared {@link DetailPanel} shell plus a standard
 * header (optional prev/next nav, title/subtitle, close) and a scrollable body. For a bespoke
 * header/tab layout, render {@link DetailPanel} directly instead.
 */
export function Drawer({ title, onClose, onPrev, onNext, children, subtitle }: DrawerProps) {
  return (
    <DetailPanel onClose={onClose} onPrev={onPrev} onNext={onNext}>
      <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-center gap-3 shrink-0">
        {(onPrev || onNext) && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onPrev}
              disabled={!onPrev}
              aria-label="Previous"
              className={`w-7 h-7 rounded-[7px] flex items-center justify-center bg-card-2 text-muted rotate-180 ${onPrev ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-30'}`}
            >
              <ChevronRightIcon size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={onNext}
              disabled={!onNext}
              aria-label="Next"
              className={`w-7 h-7 rounded-[7px] flex items-center justify-center bg-card-2 text-muted ${onNext ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-30'}`}
            >
              <ChevronRightIcon size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && <div className="text-sm font-bold text-primary truncate">{title}</div>}
          {subtitle && <div className="text-xs text-muted mt-[2px]">{subtitle}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" className="btn-icon shrink-0"><XIcon size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {children}
      </div>
    </DetailPanel>
  );
}
