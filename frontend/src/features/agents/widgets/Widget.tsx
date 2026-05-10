import { useState, type ReactNode } from 'react';
import { Modal } from '../../../components/overlays/Modal';
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
  bodyClassName = 'p-4',
  accent,
  children,
}: WidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const hasExpand = !!expandContent;
  const showHeader = title || right || hasExpand || collapsible;

  return (
    <div
      className={`bg-card rounded-lg overflow-hidden flex flex-col ${className ?? ''}`}
      style={{
        boxShadow: 'var(--shadow-card)',
        ...(accent ? { borderTop: `3px solid ${accent}` } : {}),
      }}
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
              <button
                onClick={() => setExpanded(true)}
                className="btn-icon"
                title="Expand"
                aria-label={`Expand ${title ?? 'widget'}`}
              >
                <ExpandIcon size={13} />
              </button>
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
