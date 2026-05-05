import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavItem } from './NavItem';
import { checkHealth } from '../../api/health';

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

const ICONS: Record<string, React.ReactNode> = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  activity: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  checkbox: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  scale: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 9l9-6 9 6M5 10v6a7 7 0 0 0 14 0v-6"/>
    </svg>
  ),
  play: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  sparkles: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
    </svg>
  ),
  server: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
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
              icon={ICONS[item.icon]}
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
            <div
              style={{ background: 'linear-gradient(135deg, #6b9eaa, #4a7a88)' }}
              className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-white font-semibold text-xs"
            >DP</div>
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
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-muted p-[6px] rounded-md"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
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

          <button className="text-secondary p-2 rounded-lg relative">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] rounded-full bg-accent" style={{ boxShadow: '0 0 0 2px var(--bg-primary)' }} />
          </button>

          <button
            style={{
              background: 'linear-gradient(135deg, #c9944a, #a57038)',
              boxShadow: '0 4px 14px -4px rgba(201, 148, 74, 0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
            className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12.5px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Test Suite
          </button>

          <div
            style={{ background: 'linear-gradient(135deg, #c9944a, #d4915c)' }}
            className="w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold text-white"
          >JK</div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden p-[16px_10px] bg-transparent relative z-0 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
