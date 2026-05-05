import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavItem } from './NavItem';
import { Avatar } from '../ui/Avatar';
import { checkHealth } from '../../api/health';
import {
  GridIcon, ActivityIcon, UsersIcon, CheckboxIcon, ScaleIcon, PlayIcon, SparklesIcon, ServerIcon,
  LayoutSidebarIcon, SearchIcon, BellIcon, PlusIcon,
} from '../icons';

const navItems = [
  { label: 'Dashboard', icon: 'grid', to: '/dashboard' },
  { label: 'Traces', icon: 'activity', to: '/traces', badge: '60' },
  { label: 'Agents', icon: 'users', to: '/agents' },
  { label: 'Test Suites', icon: 'checkbox', to: '/suites' },
  { label: 'Evaluators', icon: 'scale', to: '/evaluators' },
  { label: 'Test Runs', icon: 'play', to: '/runs' },
  { label: 'Proposals', icon: 'sparkles', to: '/proposals', badge: '2', badgeAccent: true },
  { label: 'Providers', icon: 'server', to: '/providers' },
] as const;

type NavIconName = typeof navItems[number]['icon'];

const NAV_ICONS: Record<NavIconName, React.ReactNode> = {
  grid: <GridIcon size={16} />,
  activity: <ActivityIcon size={16} />,
  users: <UsersIcon size={16} />,
  checkbox: <CheckboxIcon size={16} />,
  scale: <ScaleIcon size={16} />,
  play: <PlayIcon size={16} />,
  sparkles: <SparklesIcon size={16} />,
  server: <ServerIcon size={16} />,
};

export function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const ok = await checkHealth();
      if (!cancelled) setOnline(ok);
    };
    poll();
    const timer = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  const pageLabel = navItems.find(n => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';

  return (
    <div className="flex w-full h-screen overflow-hidden bg-surface relative z-[1]">
      {/* Sidebar */}
      <aside
        style={{
          width: collapsed ? '64px' : '232px',
          boxShadow: 'var(--shadow-sidebar)',
          transition: 'width 0.2s ease',
          height: 'calc(100vh - 20px)',
        }}
        className="bg-sidebar flex flex-col shrink-0 relative z-[2] m-[10px_0_10px_10px] rounded-[18px] overflow-hidden"
      >
        {/* Brand */}
        <div
          className={`h-[60px] flex items-center border-b border-hairline shrink-0 ${collapsed ? 'justify-center' : 'justify-start px-[18px]'}`}
        >
          <div
            style={{ boxShadow: '0 4px 16px -4px rgba(201, 148, 74, 0.55), inset 0 1px 0 rgba(255,255,255,0.15)', background: 'linear-gradient(135deg, #c9944a, #a57038)' }}
            className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-[13px]"
          >T</div>
          {!collapsed && (
            <div className="ml-[10px]">
              <div className="font-bold text-sm tracking-[-0.01em]">Trsr</div>
              <div className="text-[11px] text-muted mt-[-1px]">v0.1 · alpha</div>
            </div>
          )}
        </div>

        {/* Section label */}
        {!collapsed && (
          <div className="px-[18px] pt-[18px] pb-[6px] text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
            Workspace
          </div>
        )}

        {/* Nav */}
        <nav
          className={`flex-1 flex flex-col gap-[2px] overflow-y-auto ${collapsed ? 'px-2 py-3' : 'px-3 py-1.5'}`}
        >
          {navItems.map(item => (
            <NavItem
              key={item.to}
              label={item.label}
              icon={NAV_ICONS[item.icon]}
              to={item.to}
              badge={'badge' in item ? item.badge : undefined}
              badgeAccent={'badgeAccent' in item ? item.badgeAccent : undefined}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Project footer */}
        <div className={`border-t border-hairline ${collapsed ? 'p-2' : 'p-3'}`}>
          <div
            className={`flex items-center gap-[10px] cursor-pointer rounded-lg p-1 ${collapsed ? 'justify-center' : 'justify-start'}`}
          >
            <Avatar initials="DP" color="#6b9eaa" className="w-7 h-7 rounded-md text-xs font-semibold" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">Default Project</div>
                <div className="text-[11px] text-muted">3 members</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Topbar */}
        <header
          style={{
            background: 'rgba(30, 30, 34, 0.75)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            boxShadow: 'var(--shadow-topbar)',
          }}
          className="h-[56px] shrink-0 flex items-center px-4 gap-3 relative z-[1] m-[10px_10px_0_10px] rounded-[14px]"
        >
          <button onClick={() => setCollapsed(c => !c)} className="btn-icon">
            <LayoutSidebarIcon size={16} />
          </button>

          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">Default Project</span>
            <span className="text-muted">/</span>
            <span className="font-semibold">{pageLabel}</span>
          </div>

          <div
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.2)', background: 'rgba(255,255,255,0.03)' }}
            className="flex-1 max-w-[460px] mx-auto flex items-center gap-2 px-3 py-[7px] rounded-[10px] text-[13px] text-muted"
          >
            <SearchIcon size={14} />
            <span>Search traces, agents, suites…</span>
            <span className="ml-auto flex gap-[3px]">
              <kbd className="px-[6px] py-[1px] bg-card-2 rounded text-[10px] font-mono">⌘</kbd>
              <kbd className="px-[6px] py-[1px] bg-card-2 rounded text-[10px] font-mono">K</kbd>
            </span>
          </div>

          <div
            style={{
              background: online === false ? 'rgba(217,85,85,0.12)' : online === true ? 'rgba(61,170,111,0.12)' : 'var(--warn-subtle)',
              border: `1px solid ${online === false ? 'rgba(217,85,85,0.25)' : online === true ? 'rgba(61,170,111,0.25)' : 'rgba(245,158,11,0.25)'}`,
              color: online === false ? '#d95555' : online === true ? '#3daa6f' : 'var(--warn)',
            }}
            className="flex items-center gap-1.5 px-[10px] py-[6px] rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <span
              className={online === true ? 'pulse-dot' : ''}
              style={{ width: '6px', height: '6px', borderRadius: '50%', background: online === false ? '#d95555' : online === true ? '#3daa6f' : 'var(--warn)', display: 'inline-block' }}
            />
            {online === false ? 'Offline' : online === true ? 'Online' : 'Connecting…'}
          </div>

          <button className="btn-icon relative">
            <BellIcon size={16} />
            <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] rounded-full bg-accent" style={{ boxShadow: '0 0 0 2px var(--bg-primary)' }} />
          </button>

          <button
            style={{
              background: 'linear-gradient(135deg, #c9944a, #a57038)',
              boxShadow: '0 4px 14px -4px rgba(201, 148, 74, 0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
            className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12.5px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PlusIcon size={14} />
            New Test Suite
          </button>

          <Avatar initials="JK" color="#c9944a" className="w-[30px] h-[30px] rounded-full text-[11px] font-semibold" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden p-[16px_10px] bg-transparent relative z-0 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
