import { NavLink } from 'react-router-dom';

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  to: string;
  badge?: string;
  badgeAccent?: boolean;
  collapsed: boolean;
}

export function NavItem({ label, icon, to, badge, badgeAccent, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) => `nav-item${isActive ? ' nav-active' : ''}`}
      style={{ justifyContent: collapsed ? 'center' : undefined }}
    >
      {({ isActive }) => (
        <>
          {/* Active left-side indicator bar */}
          {isActive && (
            <span style={{
              position: 'absolute', left: 0, top: 8, bottom: 8, width: 2,
              background: 'var(--accent-primary)', borderRadius: '0 2px 2px 0',
            }} />
          )}
          <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
          {!collapsed && (
            <>
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
              {badge && (
                <span style={{
                  fontSize: '10px', fontWeight: 600,
                  padding: '2px 6px', borderRadius: '100px',
                  minWidth: '18px', textAlign: 'center',
                  background: badgeAccent ? 'linear-gradient(135deg, #8b5cf6, #06b6d4)' : 'var(--bg-card-2)',
                  color: badgeAccent ? '#fff' : 'var(--text-secondary)',
                }}>
                  {badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}
