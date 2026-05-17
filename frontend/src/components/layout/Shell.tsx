import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../auth/useCurrentUser';
import { NavItem } from './NavItem';
import { Avatar } from '../ui/Avatar';
import { ProjectSelector } from './ProjectSelector';
import useCurrentProject from '../../hooks/useCurrentProject';
import { checkHealth } from '../../api/health';
import { UnifiedSearch, type UnifiedSearchHandle } from '../search/UnifiedSearch';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut';
import {
  GridIcon, ActivityIcon, UsersIcon, CheckboxIcon, ScaleIcon, PlayIcon, SparklesIcon, ServerIcon,
  SettingsIcon, BeakerIcon, TargetIcon,
  LayoutSidebarIcon,
} from '../icons';

type NavIconName =
  | 'grid' | 'activity' | 'users' | 'checkbox' | 'scale' | 'play'
  | 'beaker' | 'target' | 'sparkles' | 'server' | 'settings';

interface NavEntry {
  label: string;
  icon: NavIconName;
  to: string;
}

interface NavGroup {
  label: string | null;
  items: NavEntry[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'grid', to: '/dashboard' },
      { label: 'Traces', icon: 'activity', to: '/traces' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { label: 'Agents', icon: 'users', to: '/agents' },
      { label: 'Agent Playground', icon: 'beaker', to: '/playground' },
      { label: 'Proposals', icon: 'sparkles', to: '/proposals' },
    ],
  },
  {
    label: 'Evaluators',
    items: [
      { label: 'Evaluators', icon: 'scale', to: '/evaluators' },
      { label: 'Evaluator Playground', icon: 'target', to: '/evaluator-playground' },
    ],
  },
  {
    label: 'Benchmarks',
    items: [
      { label: 'Test Suites', icon: 'checkbox', to: '/suites' },
      { label: 'Test Runs', icon: 'play', to: '/runs' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { label: 'Providers', icon: 'server', to: '/providers' },
      { label: 'Settings', icon: 'settings', to: '/settings' },
    ],
  },
];

const navItems: NavEntry[] = navGroups.flatMap(g => g.items);

const NAV_ICONS: Record<NavIconName, React.ReactNode> = {
  grid: <GridIcon size={16} />,
  activity: <ActivityIcon size={16} />,
  users: <UsersIcon size={16} />,
  checkbox: <CheckboxIcon size={16} />,
  scale: <ScaleIcon size={16} />,
  play: <PlayIcon size={16} />,
  beaker: <BeakerIcon size={16} />,
  target: <TargetIcon size={16} />,
  sparkles: <SparklesIcon size={16} />,
  server: <ServerIcon size={16} />,
  settings: <SettingsIcon size={16} />,
};

export function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const location = useLocation();
  const { currentProject } = useCurrentProject();
  const searchRef = useRef<UnifiedSearchHandle>(null);
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useGlobalShortcut('k', focusSearch);

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
  const pageLabel = [...navItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find(n => location.pathname === n.to || location.pathname.startsWith(n.to + '/'))?.label ?? 'Dashboard';
  const currentUser = useCurrentUser();
  const userName = currentUser?.email ?? 'User';
  const userInitials = userName
    .split(/[@.\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'U';

  return (
    <div className="flex w-full h-screen overflow-hidden bg-surface relative z-[1]">
      {/* Sidebar */}
      <aside
        className={`bg-sidebar flex flex-col shrink-0 relative z-[2] m-[10px_0_10px_10px] rounded-[18px] overflow-hidden shadow-[var(--shadow-sidebar)] transition-[width] duration-200 h-[calc(100vh-20px)] ${collapsed ? 'w-16' : 'w-[232px]'}`}
      >
        {/* Brand */}
        <div
          className={`h-[60px] flex items-center border-b border-hairline shrink-0 ${collapsed ? 'justify-center' : 'justify-start px-[18px]'}`}
        >
          <div
            className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-[13px] bg-[image:var(--grad-accent)] shadow-[var(--shadow-btn)]"
          >T</div>
          {!collapsed && (
            <div className="ml-[10px]">
              <div className="font-bold text-sm tracking-[-0.01em]">Trsr</div>
              <div className="text-[11px] text-muted mt-[-1px]">v0.1 · alpha</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          className={`flex-1 flex flex-col overflow-y-auto ${collapsed ? 'px-2 py-3' : 'px-3 py-2'}`}
        >
          {navGroups.map((group, gIdx) => (
            <div key={group.label ?? `__g${gIdx}`} className="flex flex-col gap-[2px]">
              {gIdx > 0 && (
                <div className={`my-1.5 border-t border-hairline ${collapsed ? 'mx-1' : 'mx-2'}`} />
              )}
              {!collapsed && group.label && (
                <div className="px-[6px] pt-1 pb-[4px] text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <NavItem
                  key={item.to}
                  label={item.label}
                  icon={NAV_ICONS[item.icon]}
                  to={item.to}
                  collapsed={collapsed}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Project footer */}
        <div className={`border-t border-hairline ${collapsed ? 'p-2' : 'p-3'}`}>
          <ProjectSelector collapsed={collapsed} />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Topbar */}
        <header
          className="h-[56px] shrink-0 flex items-center px-4 gap-3 relative z-[1] m-[10px_10px_0_10px] rounded-[14px] bg-[color-mix(in_srgb,var(--bg-sidebar)_75%,transparent)] backdrop-blur-[20px] backdrop-saturate-[140%] shadow-[var(--shadow-topbar)]"
        >
          <button onClick={() => setCollapsed(c => !c)} className="btn-icon">
            <LayoutSidebarIcon size={16} />
          </button>

          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">{currentProject?.name ?? '—'}</span>
            <span className="text-muted">/</span>
            <span className="font-semibold">{pageLabel}</span>
          </div>

          {currentProject?.id ? (
            <UnifiedSearch ref={searchRef} projectId={currentProject.id} width="fixed" />
          ) : (
            <div className="flex-1 max-w-[460px] mx-auto" />
          )}

          <div
            style={{
              background: online === false ? 'var(--danger-subtle)' : online === true ? 'var(--success-subtle)' : 'var(--warn-subtle)',
              border: `1px solid ${online === false ? 'color-mix(in srgb, var(--danger) 25%, transparent)' : online === true ? 'color-mix(in srgb, var(--success) 25%, transparent)' : 'color-mix(in srgb, var(--warn) 25%, transparent)'}`,
              color: online === false ? 'var(--danger)' : online === true ? 'var(--success)' : 'var(--warn)',
            }}
            className="flex items-center gap-1.5 px-[10px] py-[6px] rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <span
              className={`size-[6px] rounded-full inline-block ${online === true ? 'pulse-dot' : ''}`}
              style={{ background: online === false ? 'var(--danger)' : online === true ? 'var(--success)' : 'var(--warn)' }}
            />
            {online === false ? 'Offline' : online === true ? 'Online' : 'Connecting…'}
          </div>

          <button
            type="button"
            onClick={() => currentUser?.signOut()}
            title={`Sign out (${userName})`}
            className="cursor-pointer"
          >
            <Avatar initials={userInitials} color="var(--accent-primary)" className="w-[30px] h-[30px] rounded-full text-[11px] font-semibold" />
          </button>
        </header>

        {/* Page content — single vertical scroll container for the app */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden m-[10px_10px_10px_10px] bg-transparent relative z-0 flex flex-col">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
