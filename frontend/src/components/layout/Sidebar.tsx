import { Trans, useLingui } from '@lingui/react/macro';
import { NavItem } from './NavItem';
import { LockedNavItem } from './LockedNavItem';
import { isNavEntryLocked } from './navGating';
import { ProjectSelector } from './ProjectSelector';
import { navGroups, footerNavEntries, NAV_ICONS } from './shellNav';
import { useLicense } from '../../api/license';
import { useCurrentUser } from '../../auth/useCurrentUser';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useKiosk } from '../../contexts/KioskContext';
import { BrandMark } from '../ui/BrandMark';
import { ExternalLinkIcon } from '../icons';
import { cn } from '../../lib/cn';

interface SidebarProps {
  /** Desktop collapse state (icon-only rail). Ignored below md, where the drawer always shows labels. */
  collapsed: boolean;
  /** Whether the off-canvas drawer is open (below md). */
  mobileNavOpen: boolean;
  /** Close the off-canvas drawer (any nav click or backdrop tap). */
  onMobileNavClose: () => void;
}

/** App navigation rail — inline on md+, off-canvas drawer below. Pulls its own license/role/kiosk
 *  context so the Shell only owns the collapse/drawer state. */
export function Sidebar({ collapsed, mobileNavOpen, onMobileNavClose }: SidebarProps) {
  const { t, i18n } = useLingui();
  // The drawer always shows full labels — icon-only collapse is a desktop space trade-off.
  const isMobile = useIsMobile();
  const navCollapsed = isMobile ? false : collapsed;
  const { data: license } = useLicense();
  const licenseFeatures = license?.features ?? [];
  // interactive == full read-write kiosk (LLM endpoint configured); also whether Tracey is usable.
  const { interactive } = useKiosk();
  // Role is only populated in local-auth mode; OIDC users won't see admin-only nav (the backend
  // still enforces authorization regardless).
  const isAdmin = useCurrentUser()?.role === 'Admin';

  // Visibility filters run before rendering so a fully-hidden group (e.g. the Tracey hero slot on
  // a read-only kiosk) drops out entirely instead of leaving a stray divider.
  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items
        // Hide Tracey's nav entry when the kiosk is read-only (no LLM endpoint configured).
        .filter(item => !(item.to === '/tracey-ai' && !interactive))
        .filter(item => !item.adminOnly || isAdmin),
    }))
    .filter(group => group.items.length > 0);
  const visibleFooterEntries = footerNavEntries.filter(item => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Mobile nav backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-[59] bg-black/[0.5] md:hidden"
          onClick={onMobileNavClose}
        />
      )}

      {/* Sidebar — inline rail on md+, off-canvas drawer below */}
      <aside
        className={cn(
          'bg-sidebar flex flex-col shrink-0 overflow-hidden shadow-[var(--shadow-sidebar)]',
          'md:relative md:z-[2] md:m-[10px_0_10px_10px] md:rounded-xl md:transition-[width] md:duration-200 md:h-[calc(100vh-20px)]',
          collapsed ? 'md:w-16' : 'md:w-[232px]',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[60] max-md:w-[264px] max-md:rounded-r-xl max-md:transition-transform max-md:duration-200',
          mobileNavOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        {/* Brand */}
        <div
          className={`h-[60px] flex items-center border-b border-hairline shrink-0 ${navCollapsed ? 'justify-center' : 'justify-start px-4.5'}`}
        >
          <BrandMark size={30} />
          {!navCollapsed && (
            <div className="ml-2.5">
              <div className="font-bold text-body tracking-[-0.02em] leading-none">
                {/* eslint-disable-next-line lingui/no-unlocalized-strings -- brand name, not translated */}
                <span className="text-primary">proxy</span><span className="text-accent">trace</span>
              </div>
              {/* eslint-disable-next-line lingui/no-unlocalized-strings -- version identifier, not UI copy */}
              <div className="font-mono text-caption text-muted mt-0.5">{`v${__APP_VERSION__}`}</div>
            </div>
          )}
        </div>

        {/* Nav — any link click closes the mobile drawer (clicks bubble up from NavItem). */}
        <nav
          onClick={onMobileNavClose}
          className={`flex-1 flex flex-col overflow-y-auto ${navCollapsed ? 'px-2 py-3' : 'px-3 py-2'}`}
        >
          {visibleGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-0.5">
              {gIdx > 0 && (
                <div className={`my-1.5 border-t border-hairline ${navCollapsed ? 'mx-1' : 'mx-2'}`} />
              )}
              {!navCollapsed && group.label && (
                <div className="px-1.5 pt-1 pb-1 text-caption font-semibold tracking-[0.08em] text-muted uppercase">
                  {i18n._(group.label)}
                </div>
              )}
              {group.items.map(item =>
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

        {/* Utility zone — audit log, admin settings, docs. Link clicks close the mobile drawer. */}
        <div
          onClick={onMobileNavClose}
          className={`flex flex-col gap-0.5 border-t border-hairline ${navCollapsed ? 'px-2 py-2' : 'px-3 py-2'}`}
        >
          {visibleFooterEntries.map(item => (
            <NavItem
              key={item.to}
              label={i18n._(item.label)}
              icon={NAV_ICONS[item.icon]}
              to={item.to}
              collapsed={navCollapsed}
            />
          ))}
          {/* Docs link — opens the bundled manual served at /docs */}
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
    </>
  );
}
