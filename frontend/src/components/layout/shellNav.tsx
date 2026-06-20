import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import type { LicenseFeature } from '../../api/license';
import { cn } from '../../lib/cn';
import {
  GridIcon, ActivityIcon, UsersIcon, CheckboxIcon, ScaleIcon, PlayIcon, SparklesIcon, ServerIcon,
  SettingsIcon, BeakerIcon, TargetIcon, MessageSparkleIcon, AlertTriangleIcon, ClockIcon,
} from '../icons';

type NavIconName =
  | 'grid' | 'activity' | 'users' | 'checkbox' | 'scale' | 'play'
  | 'beaker' | 'target' | 'sparkles' | 'server' | 'settings' | 'tracey' | 'alert' | 'history';

export interface NavEntry {
  label: MessageDescriptor;
  icon: NavIconName;
  to: string;
  requiresFeature?: LicenseFeature;
  /** Only rendered for admin users (backend still enforces authorization). */
  adminOnly?: boolean;
}

export interface NavGroup {
  // Group labels are translated; resolve at render with i18n._(). Item labels stay English
  // (glossary terms — Traces, Agents, Proposals, …).
  label: MessageDescriptor | null;
  items: NavEntry[];
}

export const navGroups: NavGroup[] = [
  {
    label: msg`Overview`,
    items: [
      { label: msg`Dashboard`, icon: 'grid', to: '/dashboard' },
      { label: msg`Traces`, icon: 'activity', to: '/traces' },
      // eslint-disable-next-line lingui/no-unlocalized-strings -- LicenseFeature enum value, not UI copy
      { label: msg`Tracey AI`, icon: 'tracey', to: '/tracey-ai', requiresFeature: 'Tracey' },
      { label: msg`Audit Log`, icon: 'history', to: '/audit-log' },
    ],
  },
  {
    label: msg`Agents`,
    items: [
      { label: msg`Agents`, icon: 'users', to: '/agents' },
      { label: msg`Agent Playground`, icon: 'beaker', to: '/playground' },
      // eslint-disable-next-line lingui/no-unlocalized-strings -- LicenseFeature enum value, not UI copy
      { label: msg`Proposals`, icon: 'sparkles', to: '/proposals', requiresFeature: 'OptimizationProposals' },
    ],
  },
  {
    label: msg`Evaluators`,
    items: [
      { label: msg`Evaluators`, icon: 'scale', to: '/evaluators' },
      { label: msg`Evaluator Playground`, icon: 'target', to: '/evaluator-playground' },
    ],
  },
  {
    label: msg`Benchmarks`,
    items: [
      { label: msg`Test Suites`, icon: 'checkbox', to: '/suites' },
      { label: msg`Test Runs`, icon: 'play', to: '/runs' },
    ],
  },
];

export const navItems: NavEntry[] = navGroups.flatMap(g => g.items);

export const NAV_ICONS: Record<NavIconName, React.ReactNode> = {
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
  history: <ClockIcon size={16} />,
};

export type HealthStatus = 'online' | 'offline' | 'connecting';

export const HEALTH_PILL: Record<HealthStatus, string> = {
  online: cn('bg-success-subtle border-[color-mix(in_srgb,var(--success)_25%,transparent)] text-success'),
  offline: cn('bg-danger-subtle border-[color-mix(in_srgb,var(--danger)_25%,transparent)] text-danger'),
  connecting: cn('bg-warn-subtle border-[color-mix(in_srgb,var(--warn)_25%,transparent)] text-warn'),
};

export const HEALTH_DOT: Record<HealthStatus, string> = {
  online: cn('bg-success'),
  offline: cn('bg-danger'),
  connecting: cn('bg-warn'),
};

export const HEALTH_LABEL: Record<HealthStatus, MessageDescriptor> = {
  online: msg`Online`,
  offline: msg`Offline`,
  connecting: msg`Connecting…`,
};
