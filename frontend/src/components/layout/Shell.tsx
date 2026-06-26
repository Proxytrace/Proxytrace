import { useState, lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { GracePeriodBanner } from '../license/GracePeriodBanner';
import { InvalidLicenseBanner } from '../license/InvalidLicenseBanner';
import { QuotaBanner } from '../license/QuotaBanner';
import { UpdateBanner } from '../updates/UpdateBanner';
import { useIsMobile } from '../../hooks/useMediaQuery';

// The Tracey chat stack (assistant-ui + ai SDK + tools + docs index) is heavy; loading it
// lazily keeps it out of the main chunk so first paint of every page is faster.
const TraceyHost = lazy(() => import('../../features/tracey/TraceyHost'));

/** App frame: navigation rail + top bar + the routed page. Orchestration only — the rail and bar
 *  own their own data; the Shell owns just the collapse/drawer state and the page scroll container. */
export function Shell() {
  // Start collapsed on narrow viewports (laptops below 1280px) so page content gets the width;
  // the user can still expand manually. Initial-render check only — no resize listener, so a
  // deliberate toggle is never fought.
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 1279px)').matches);
  // Below md the sidebar is an off-canvas drawer instead of an inline rail.
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleSidebar = () => (isMobile ? setMobileNavOpen(v => !v) : setCollapsed(c => !c));

  return (
    // Transparent so the body's aurora/grain atmosphere shows through the page gutters.
    <div className="flex w-full h-screen overflow-hidden bg-transparent relative z-[1]">
      <Sidebar
        collapsed={collapsed}
        mobileNavOpen={mobileNavOpen}
        onMobileNavClose={() => setMobileNavOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <InvalidLicenseBanner />
        <GracePeriodBanner />
        <QuotaBanner />
        <UpdateBanner />
        <Topbar onToggleSidebar={toggleSidebar} />

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
