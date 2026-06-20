import { useState, type ReactNode } from 'react';
import { useLingui } from '@lingui/react/macro';
import { Modal } from '../../../components/overlays/Modal';
import { IconButton } from '../../../components/ui/Button';
import { cn } from '../../../lib/cn';
import { ExpandIcon, ChevronDownIcon } from '../../../components/icons';

interface WidgetProps {
  title?: string;
  right?: ReactNode;
  expandTitle?: string;
  expandContent?: ReactNode;
  expandMaxWidth?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  bodyClassName?: string;
  accent?: string;
  children: ReactNode;
}

export function Widget({
  title,
  right,
  expandTitle,
  expandContent,
  expandMaxWidth = 720,
  collapsible = false,
  defaultCollapsed = false,
  className,
  bodyClassName = cn('p-4'),
  accent,
  children,
}: WidgetProps) {
  const { t } = useLingui();
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const expandLabel = title ?? t`widget`;
  const hasExpand = !!expandContent;
  const showHeader = title || right || hasExpand || collapsible;

  return (
    <div
      className={`bg-card rounded-lg overflow-hidden flex flex-col shadow-[var(--shadow-card)] ${className ?? ''}`}
      style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
    >
      {showHeader && (
        <div
          className={`flex items-center gap-2 px-4 py-3 ${collapsed ? '' : 'border-b border-hairline'}${
            collapsible ? ' cursor-pointer hover:bg-[var(--bg-wash-hover)] transition-colors duration-100' : ''
          }`}
          onClick={collapsible ? () => setCollapsed(c => !c) : undefined}
          role={collapsible ? 'button' : undefined}
          tabIndex={collapsible ? 0 : undefined}
          onKeyDown={
            collapsible
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCollapsed(c => !c);
                  }
                }
              : undefined
          }
        >
          {collapsible && (
            <ChevronDownIcon
              size={12}
              className={`text-muted transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
            />
          )}
          {title && <span className="text-h2 font-semibold tracking-[-0.005em]">{title}</span>}
          <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {right}
            {hasExpand && (
              <IconButton
                onClick={() => setExpanded(true)}
                title={t`Expand`}
                aria-label={t`Expand ${expandLabel}`}
              >
                <ExpandIcon size={13} />
              </IconButton>
            )}
          </div>
        </div>
      )}
      {!collapsed && (
        <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
      )}

      {expanded && hasExpand && (
        <Modal
          title={expandTitle ?? title}
          onClose={() => setExpanded(false)}
          maxWidth={expandMaxWidth}
        >
          {expandContent}
        </Modal>
      )}
    </div>
  );
}
