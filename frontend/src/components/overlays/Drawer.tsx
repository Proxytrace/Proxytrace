import { useLingui } from '@lingui/react/macro';
import { IconButton } from '../ui/Button';
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
  const { t } = useLingui();
  return (
    <DetailPanel onClose={onClose} onPrev={onPrev} onNext={onNext}>
      <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-center gap-3 shrink-0">
        {(onPrev || onNext) && (
          <div className="flex gap-1 shrink-0">
            <IconButton
              size="sm"
              onClick={onPrev}
              disabled={!onPrev}
              aria-label={t`Previous`}
              className="rotate-180 disabled:opacity-30"
            >
              <ChevronRightIcon size={14} strokeWidth={2.5} />
            </IconButton>
            <IconButton
              size="sm"
              onClick={onNext}
              disabled={!onNext}
              aria-label={t`Next`}
              className="disabled:opacity-30"
            >
              <ChevronRightIcon size={14} strokeWidth={2.5} />
            </IconButton>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && <div className="text-h2 font-semibold text-primary truncate">{title}</div>}
          {subtitle && <div className="text-body-sm text-muted mt-0.5">{subtitle}</div>}
        </div>
        <IconButton onClick={onClose} aria-label={t`Close`} className="shrink-0"><XIcon size={14} /></IconButton>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {children}
      </div>
    </DetailPanel>
  );
}
