import { useState, useCallback, useRef, lazy, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCurrentUser } from '../../auth/useCurrentUser';
import { useAuthMode } from '../../auth/authMode';
import { LanguageMenuItems } from './LanguageMenuItems';
import { EmailNotificationMenuItems } from './EmailNotificationMenuItems';
import { NavItem } from './NavItem';
import { LockedNavItem } from './LockedNavItem';
import { isNavEntryLocked } from './navGating';
import { useLicense } from '../../api/license';
import { LicenseBadge } from '../license/LicenseBadge';
import { GracePeriodBanner } from '../license/GracePeriodBanner';
import { InvalidLicenseBanner } from '../license/InvalidLicenseBanner';
import { QuotaBanner } from '../license/QuotaBanner';
import { UpdateBanner } from '../updates/UpdateBanner';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { BrandMark } from '../ui/BrandMark';
import { ProjectSelector } from './ProjectSelector';
import { NotificationsMenu } from '../../features/notifications/NotificationsMenu';
import useCurrentProject from '../../hooks/useCurrentProject';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useKiosk } from '../../contexts/KioskContext';
import { useHealth } from '../../hooks/useHealth';
import { cn } from '../../lib/cn';
import { UnifiedSearch, type UnifiedSearchHandle } from '../search/UnifiedSearch';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut';
import { LayoutSidebarIcon, ExternalLinkIcon, LogOutIcon, LockIcon } from '../icons';
import {
  navGroups, navItems, NAV_ICONS, HEALTH_PILL, HEALTH_DOT, HEALTH_LABEL, type HealthStatus,
} from './shellNav';

// The Tracey chat stack (assistant-ui + ai SDK + tools + docs index) is heavy; loading it
// lazily keeps it out of the main chunk so first paint of every page is faster.
const TraceyHost = lazy(() => import('../../features/tracey/TraceyHost'));

// Layout variant token (not UI copy) — typed so the literal is recognized as non-copy.
const SEARCH_WIDTH: 'auto' | 'fixed' = 'fixed';

export function Shell() {
  const { t, i18n } = useLingui();
  // Start collapsed on narrow viewports (laptops below 1280px) so page content gets the width;
  // the user can still expand manually. Initial-render check only — no resize listener, so a
  // deliberate toggle is never fought.
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 1279px)').matches);
  // Below md the sidebar is an off-canvas drawer instead of an inline rail.
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // The drawer always shows full labels — icon-only collapse is a desktop space trade-off.
  const navCollapsed = isMobile ? false : collapsed;
  const { data: online } = useHealth();
  const { data: license } = useLicense();
  const licenseFeatures = license?.features ?? [];
  const location = useLocation();
  const navigate = useNavigate();
  const { data: authMode } = useAuthMode();
  const { currentProject } = useCurrentProject();
  // interactive == full read-write kiosk (LLM endpoint configured); also whether Tracey is usable.
  const { interactive, enabled: kioskEnabled } = useKiosk();
  // The account-security (MFA) page only applies to real local-auth sessions — not OIDC (managed by
  // the IdP) and not the login-free kiosk.
  const showAccountMenu = authMode?.mode === 'local' && !kioskEnabled;
  const searchRef = useRef<UnifiedSearchHandle>(null);
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  // eslint-disable-next-line lingui/no-unlocalized-strings -- keyboard shortcut key, not UI copy
  useGlobalShortcut('k', focusSearch);

  const healthStatus: HealthStatus = online === true ? 'online' : online === false ? 'offline' : 'connecting';
  const activeNavEntry = [...navItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find(n => location.pathname === n.to || location.pathname.startsWith(n.to + '/'));
  const pageLabel = activeNavEntry ? i18n._(activeNavEntry.label) : t`Dashboard`;
  const currentUser = useCurrentUser();
  // Role is only populated in local-auth mode; OIDC users won't see admin-only nav (the backend
  // still enforces authorization regardless).
  const isAdmin = currentUser?.role === 'Admin';
  const userName = currentUser?.email ?? t`User`;
  const userInitials = userName
    .split(/[@.\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    // eslint-disable-next-line lingui/no-unlocalized-strings -- avatar initials fallback, not UI copy
    .slice(0, 2) || 'U';

  return (
    // Transparent so the body's aurora/grain atmosphere shows through the page gutters.
    <div className="flex w-full h-screen overflow-hidden bg-transparent relative z-[1]">
      {/* Mobile nav backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-[59] bg-[rgba(0,0,0,0.5)] md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar — inline rail on md+, off-canvas drawer below */}
      <aside
        className={cn(
          'bg-sidebar flex flex-col shrink-0 overflow-hidden shadow-[var(--shadow-sidebar)]',
          'md:relative md:z-[2] md:m-[10px_0_10px_10px] md:rounded-[18px] md:transition-[width] md:duration-200 md:h-[calc(100vh-20px)]',
          collapsed ? 'md:w-16' : 'md:w-[232px]',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[60] max-md:w-[264px] max-md:rounded-r-[18px] max-md:transition-transform max-md:duration-200',
          mobileNavOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        {/* Brand */}
        <div
          className={`h-[60px] flex items-center border-b border-hairline shrink-0 ${navCollapsed ? 'justify-center' : 'justify-start px-[18px]'}`}
        >
          <BrandMark size={30} />
          {!navCollapsed && (
            <div className="ml-[10px]">
              <div className="font-bold text-sm tracking-[-0.02em] leading-none">
                {/* eslint-disable-next-line lingui/no-unlocalized-strings -- brand name, not translated */}
                <span className="text-primary">proxy</span><span className="text-accent">trace</span>
              </div>
              {/* eslint-disable-next-line lingui/no-unlocalized-strings -- version identifier, not UI copy */}
              <div className="font-mono text-[10.5px] text-muted mt-0.5">{`v${__APP_VERSION__}`}</div>
            </div>
          )}
        </div>

        {/* Nav — any link click closes the mobile drawer (clicks bubble up from NavItem). */}
        <nav
          onClick={() => setMobileNavOpen(false)}
          className={`flex-1 flex flex-col overflow-y-auto ${navCollapsed ? 'px-2 py-3' : 'px-3 py-2'}`}
        >
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-[2px]">
              {gIdx > 0 && (
                <div className={`my-1.5 border-t border-hairline ${navCollapsed ? 'mx-1' : 'mx-2'}`} />
              )}
              {!navCollapsed && group.label && (
                <div className="px-[6px] pt-1 pb-[4px] text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
                  {i18n._(group.label)}
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
                    label={i18n._(item.label)}
                    icon={NAV_ICONS[item.icon]}
                    collapsed={navCollapsed}
                  />
                ) : (
                  <NavItem
                    key={item.to}
                    label={i18n._(item.label)}
                    icon={NAV_ICONS[item.icon]}
                    to={item.to}
                    collapsed={navCollapsed}
                  />
                ),
              )}
            </div>
          ))}
        </nav>

        {/* Docs link — opens the bundled manual served at /docs */}
        <div className={`${navCollapsed ? 'px-2' : 'px-3'}`}>
          <a
            href="/docs/"
            target="_blank"
            rel="noopener noreferrer"
            title={navCollapsed ? t`Documentation` : undefined}
            className={`nav-item${navCollapsed ? ' justify-center' : ''}`}
          >
            <span className="flex shrink-0"><ExternalLinkIcon size={16} /></span>
            {!navCollapsed && <span className="flex-1 text-left"><Trans>Documentation</Trans></span>}
          </a>
        </div>

        {/* Project footer */}
        <div className={`border-t border-hairline ${navCollapsed ? 'p-2' : 'p-3'}`}>
          <ProjectSelector collapsed={navCollapsed} />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <InvalidLicenseBanner />
        <GracePeriodBanner />
        <QuotaBanner />
        <UpdateBanner />
        {/* Topbar */}
        <header
          className="h-[56px] shrink-0 flex items-center px-4 gap-3 relative z-[3] m-[10px_10px_0_10px] rounded-[14px] bg-[color-mix(in_srgb,var(--bg-sidebar)_75%,transparent)] backdrop-blur-[20px] backdrop-saturate-[140%] shadow-[var(--shadow-topbar)]"
        >
          <IconButton
            onClick={() => (isMobile ? setMobileNavOpen(v => !v) : setCollapsed(c => !c))}
            aria-label={t`Toggle sidebar`}
          >
            <LayoutSidebarIcon size={16} />
          </IconButton>

          <div className="flex items-center gap-2 text-[13px] min-w-0 shrink whitespace-nowrap">
            <span className="text-muted truncate max-w-[180px] hidden md:inline">{currentProject?.name ?? '—'}</span>
            <span className="text-muted hidden md:inline">/</span>
            <span className="font-semibold truncate">{pageLabel}</span>
          </div>

          {/* Search needs real width to be usable — below sm it yields to the page title. */}
          <div className="flex-1 min-w-0 hidden sm:block">
            {currentProject?.id ? (
              <UnifiedSearch ref={searchRef} projectId={currentProject.id} width={SEARCH_WIDTH} />
            ) : (
              <div className="flex-1 max-w-[720px] mx-auto" />
            )}
          </div>
          <div className="flex-1 sm:hidden" />

          <div
            title={i18n._(HEALTH_LABEL[healthStatus])}
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
            {/* Dot-only below lg — the label is redundant with the color + title on tight topbars. */}
            <span className="hidden lg:inline">{i18n._(HEALTH_LABEL[healthStatus])}</span>
          </div>

          <span className="hidden sm:contents"><LicenseBadge /></span>

          <NotificationsMenu />

          <Menu
            trigger={
              <IconButton
                data-testid="user-menu-trigger"
                title={userName}
                aria-label={t`User menu (${userName})`}
              >
                <Avatar initials={userInitials} color="var(--accent-primary)" className="w-[30px] h-[30px] rounded-full text-[11px] font-semibold" />
              </IconButton>
            }
          >
            <EmailNotificationMenuItems />
            <LanguageMenuItems />
            {showAccountMenu && (
              <Menu.Item
                data-testid="account-security-btn"
                icon={<LockIcon size={15} />}
                onSelect={() => navigate('/account')}
              >
                <Trans>Account security</Trans>
              </Menu.Item>
            )}
            <Menu.Item
              data-testid="logout-btn"
              icon={<LogOutIcon size={15} />}
              onSelect={() => currentUser?.signOut()}
            >
              <Trans>Logout</Trans>
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
          {/* TraceyHost mounts the chat runtime here — above the router `Outlet`, not on the
              Tracey page — so the conversation survives navigation. It is lazy: while its chunk
              loads (in parallel with the route chunk) the page area shows the same loader the
              route Suspense would. */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center flex-1 text-muted text-[13px]">
                <Trans>Loading…</Trans>
              </div>
            }
          >
            <TraceyHost>
              <Outlet />
            </TraceyHost>
          </Suspense>
        </main>
      </div>

    </div>
  );
}
