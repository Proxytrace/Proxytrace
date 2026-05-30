import { Link } from 'react-router-dom';
import { LockIcon } from '../icons';

/**
 * A nav row whose feature is not licensed. Stays visible (it advertises the
 * Enterprise feature) but is dimmed, shows a lock, and routes to /upgrade
 * instead of the gated page.
 */
export function LockedNavItem({ label, icon, collapsed }: {
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
}) {
  return (
    <Link
      to="/upgrade"
      title={collapsed ? `${label} (Enterprise)` : 'Requires Enterprise'}
      data-testid={`nav-locked-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className={`nav-item opacity-60${collapsed ? ' justify-center' : ''}`}
    >
      <span className="flex shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          <LockIcon size={13} className="shrink-0 text-muted" />
        </>
      )}
    </Link>
  );
}
