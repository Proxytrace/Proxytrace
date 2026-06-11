import { useState, useCallback, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../auth/useCurrentUser';
import { NavItem } from './NavItem';
import { LockedNavItem } from './LockedNavItem';
import { isNavEntryLocked } from './navGating';
import { useLicense, type LicenseFeature } from '../../api/license';
import { LicenseBadge } from '../license/LicenseBadge';
import { GracePeriodBanner } from '../license/GracePeriodBanner';
import { QuotaBanner } from '../license/QuotaBanner';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { BrandMark } from '../ui/BrandMark';
import { ProjectSelector } from './ProjectSelector';
import useCurrentProject from '../../hooks/useCurrentProject';
import { useKiosk } from '../../contexts/KioskContext';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useTraceyChat } from '../../features/tracey/useTraceyChat';
import { TraceyChatProvider } from '../../features/tracey/tracey-chat-context';
import { TraceyActionsProvider } from '../../features/tracey/tracey-actions';
import { useHealth } from '../../hooks/useHealth';
import { cn } from '../../lib/cn';
import { UnifiedSearch, type UnifiedSearchHandle } from '../search/UnifiedSearch';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut';
import {
  GridIcon, ActivityIcon, UsersIcon, CheckboxIcon, ScaleIcon, PlayIcon, SparklesIcon, ServerIcon,
  SettingsIcon, BeakerIcon, TargetIcon, MessageSparkleIcon, AlertTriangleIcon,
  LayoutSidebarIcon, ExternalLinkIcon, LogOutIcon,
} from '../icons';

type NavIconName =
  | 'grid' | 'activity' | 'users' | 'checkbox' | 'scale' | 'play'
  | 'beaker' | 'target' | 'sparkles' | 'server' | 'settings' | 'tracey' | 'alert';

interface NavEntry {
  label: string;
  icon: NavIconName;
  to: string;
  requiresFeature?: LicenseFeature;
  /** Only rendered for admin users (backend still enforces authorization). */
  adminOnly?: boolean;
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
      { label: 'Tracey AI', icon: 'tracey', to: '/tracey-ai' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { label: 'Agents', icon: 'users', to: '/agents' },
      { label: 'Agent Playground', icon: 'beaker', to: '/playground' },
      { label: 'Proposals', icon: 'sparkles', to: '/proposals', requiresFeature: 'OptimizationProposals' },
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
  tracey: <MessageSparkleIcon size={16} />,
  alert: <AlertTriangleIcon size={16} />,
};

type HealthStatus = 'online' | 'offline' | 'connecting';

const HEALTH_PILL: Record<HealthStatus, string> = {
  online: 'bg-success-subtle border-[color-mix(in_srgb,var(--success)_25%,transparent)] text-success',
  offline: 'bg-danger-subtle border-[color-mix(in_srgb,var(--danger)_25%,transparent)] text-danger',
  connecting: 'bg-warn-subtle border-[color-mix(in_srgb,var(--warn)_25%,transparent)] text-warn',
};

const HEALTH_DOT: Record<HealthStatus, string> = {
  online: 'bg-success',
  offline: 'bg-danger',
  connecting: 'bg-warn',
};

const HEALTH_LABEL: Record<HealthStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  connecting: 'Connecting…',
};

export function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { data: online } = useHealth();
  const { data: license } = useLicense();
  const licenseFeatures = license?.features ?? [];
  const location = useLocation();
  const { currentProject } = useCurrentProject();
  // interactive == full read-write kiosk (LLM endpoint configured); also whether Tracey is usable.
  const { interactive } = useKiosk();
  const searchRef = useRef<UnifiedSearchHandle>(null);
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useGlobalShortcut('k', focusSearch);
  // The Tracey chat is created here — above the router `Outlet` — so its runtime and
  // conversation persist while the user navigates between routes (the `/tracey-ai` page just
  // renders this shared runtime). When Tracey is unavailable, no session is created.
  const traceyChat = useTraceyChat();

  const healthStatus = online === true ? 'online' : online === false ? 'offline' : 'connecting';
  const pageLabel = [...navItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find(n => location.pathname === n.to || location.pathname.startsWith(n.to + '/'))?.label ?? 'Dashboard';
  const currentUser = useCurrentUser();
  // Role is only populated in local-auth mode; OIDC users won't see admin-only nav (the backend
  // still enforces authorization regardless).
  const isAdmin = currentUser?.role === 'Admin';
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
          <BrandMark size={30} />
          {!collapsed && (
            <div className="ml-[10px]">
              <div className="font-bold text-sm tracking-[-0.02em] leading-none">
                <span className="text-primary">proxy</span><span className="text-accent">trace</span>
              </div>
              <div className="font-mono text-[10.5px] text-muted mt-0.5">v0.1 · alpha</div>
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
              {group.items
                // Hide Tracey's nav entry when the kiosk is read-only (no LLM endpoint configured).
                .filter(item => !(item.to === '/tracey-ai' && !interactive))
                // Admin-only entries (e.g. Error Log) are hidden for non-admins.
                .filter(item => !item.adminOnly || isAdmin)
                .map(item =>
                isNavEntryLocked(item.requiresFeature, licenseFeatures) ? (
                  <LockedNavItem
                    key={item.to}
                    label={item.label}
                    icon={NAV_ICONS[item.icon]}
                    collapsed={collapsed}
                  />
                ) : (
                  <NavItem
                    key={item.to}
                    label={item.label}
                    icon={NAV_ICONS[item.icon]}
                    to={item.to}
                    collapsed={collapsed}
                  />
                ),
              )}
            </div>
          ))}
        </nav>

        {/* Docs link — opens the bundled manual served at /docs */}
        <div className={`${collapsed ? 'px-2' : 'px-3'}`}>
          <a
            href="/docs/"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'Documentation' : undefined}
            className={`nav-item${collapsed ? ' justify-center' : ''}`}
          >
            <span className="flex shrink-0"><ExternalLinkIcon size={16} /></span>
            {!collapsed && <span className="flex-1 text-left">Documentation</span>}
          </a>
        </div>

        {/* Project footer */}
        <div className={`border-t border-hairline ${collapsed ? 'p-2' : 'p-3'}`}>
          <ProjectSelector collapsed={collapsed} />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <GracePeriodBanner />
        <QuotaBanner />
        {/* Topbar */}
        <header
          className="h-[56px] shrink-0 flex items-center px-4 gap-3 relative z-[3] m-[10px_10px_0_10px] rounded-[14px] bg-[color-mix(in_srgb,var(--bg-sidebar)_75%,transparent)] backdrop-blur-[20px] backdrop-saturate-[140%] shadow-[var(--shadow-topbar)]"
        >
          <IconButton onClick={() => setCollapsed(c => !c)} aria-label="Toggle sidebar">
            <LayoutSidebarIcon size={16} />
          </IconButton>

          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">{currentProject?.name ?? '—'}</span>
            <span className="text-muted">/</span>
            <span className="font-semibold">{pageLabel}</span>
          </div>

          {currentProject?.id ? (
            <UnifiedSearch ref={searchRef} projectId={currentProject.id} width="fixed" />
          ) : (
            <div className="flex-1 max-w-[720px] mx-auto" />
          )}

          <div
            className={cn(
              'flex items-center gap-1.5 px-[10px] py-[6px] rounded-full border text-xs font-semibold whitespace-nowrap shrink-0',
              HEALTH_PILL[healthStatus],
            )}
          >
            <span
              className={cn(
                'size-[6px] rounded-full inline-block',
                HEALTH_DOT[healthStatus],
                healthStatus === 'online' && 'pulse-dot',
              )}
            />
            {HEALTH_LABEL[healthStatus]}
          </div>

          <LicenseBadge />

          {interactive && (
            <IconButton
              data-testid="tracey-toggle"
              onClick={() => navigate('/tracey-ai')}
              title="Tracey — AI assistant"
              aria-label="Tracey — AI assistant"
              className={cn(location.pathname.startsWith('/tracey-ai') && 'text-accent')}
            >
              <MessageSparkleIcon size={16} />
            </IconButton>
          )}

          <Menu
            trigger={
              <IconButton
                data-testid="user-menu-trigger"
                title={userName}
                aria-label={`User menu (${userName})`}
              >
                <Avatar initials={userInitials} color="var(--accent-primary)" className="w-[30px] h-[30px] rounded-full text-[11px] font-semibold" />
              </IconButton>
            }
          >
            <Menu.Item
              data-testid="logout-btn"
              icon={<LogOutIcon size={15} />}
              onSelect={() => currentUser?.signOut()}
            >
              Logout
            </Menu.Item>
          </Menu>
        </header>

        {/* Page content — single vertical scroll container for the app */}
        {/* Flush the scroll container to the window's right edge and inset the content with
            right padding instead of a margin. Firefox/Linux uses overlay scrollbars, so
            `scrollbar-gutter: stable` does NOT reserve space — the thumb would paint over the
            content. With the container flush + `pr-[10px]`, the overlay thumb floats in the
            padding strip and never overlaps cards, while staying glued to the screen edge. */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden m-[10px_0_10px_10px] pr-[10px] bg-transparent relative z-0 flex flex-col">
          {/* The runtime provider mounts here — above the router `Outlet` — not on the Tracey
              page. assistant-ui keeps the conversation's message state inside the component
              subtree the provider renders, so mounting it per-route would destroy the thread on
              every navigation. Hoisting it here is what actually makes the chat survive nav. */}
          <TraceyChatProvider value={traceyChat}>
            <TraceyActionsProvider value={{ navigate: traceyChat.navigate }}>
              <AssistantRuntimeProvider runtime={traceyChat.runtime}>
                <Outlet />
              </AssistantRuntimeProvider>
            </TraceyActionsProvider>
          </TraceyChatProvider>
        </main>
      </div>

    </div>
  );
}
