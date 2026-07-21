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
      className={({ isActive }) => `nav-item${isActive ? ' nav-active' : ''}${collapsed ? ' justify-center' : ''}`}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-accent rounded-[0_2px_2px_0]" />
          )}
          <span className="flex shrink-0">{icon}</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <span
                  className={`text-caption font-semibold px-1.5 py-0.5 rounded-none min-w-[18px] text-center ${
                    badgeAccent ? 'bg-accent text-accent-ink' : 'bg-card-2 text-secondary'
                  }`}
                >
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
