import { NavLink } from 'react-router-dom';
import { cn } from '../../../lib/cn';

interface NavLeaf {
  label: string;
  to: string;
  testId: string;
}

interface NavSection {
  heading: string;
  items: NavLeaf[];
}

// The whole settings area is admin-only (route-gated in App.tsx), so every visitor here is an
// admin — no per-item gating is needed. The split is purely conceptual: settings that belong to
// the active project vs. settings that span the whole workspace.
const SECTIONS: NavSection[] = [
  {
    heading: 'Project',
    items: [
      { label: 'General', to: '/settings/general', testId: 'settings-nav-general' },
      { label: 'Members', to: '/settings/members', testId: 'settings-nav-members' },
      { label: 'Search indexing', to: '/settings/search', testId: 'settings-nav-search' },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { label: 'Projects', to: '/settings/projects', testId: 'settings-nav-projects' },
      { label: 'Providers', to: '/settings/providers', testId: 'settings-nav-providers' },
      { label: 'Users', to: '/settings/users', testId: 'settings-nav-users' },
      { label: 'License', to: '/settings/license', testId: 'settings-nav-license' },
      { label: 'Error log', to: '/settings/error-log', testId: 'settings-nav-error-log' },
      { label: 'Danger zone', to: '/settings/danger', testId: 'settings-nav-danger' },
    ],
  },
];

export function SettingsNav() {
  return (
    // A plain container, not a <nav> landmark: the app shell's sidebar is the page's single
    // navigation landmark, and a second one would break the smoke test's getByRole('navigation').
    <div
      data-testid="settings-nav"
      className="w-[196px] shrink-0 overflow-y-auto flex flex-col gap-4 pr-1"
    >
      {SECTIONS.map(section => (
        <div key={section.heading} className="flex flex-col gap-[2px]">
          <div className="px-2 pb-1 text-caption font-semibold tracking-[0.08em] text-muted uppercase">
            {section.heading}
          </div>
          {section.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testId}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-[7px] rounded-md text-title transition-colors cursor-pointer',
                  isActive
                    ? 'bg-[color-mix(in_srgb,_var(--accent-primary)_12%,_transparent)] text-primary font-semibold'
                    : 'text-secondary hover:text-primary hover:bg-white/[.04]',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  );
}
