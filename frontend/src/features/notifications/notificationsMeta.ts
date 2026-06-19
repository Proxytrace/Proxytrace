import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { NotificationSeverity, NotificationTargetKind } from '../../api/models';
import type { BadgeVariant } from '../../components/ui/Badge';

const SEVERITY_VARIANT: Record<NotificationSeverity, BadgeVariant> = {
  [NotificationSeverity.Info]: 'accent',
  [NotificationSeverity.Warning]: 'warn',
  [NotificationSeverity.Critical]: 'danger',
};

const SEVERITY_LABEL: Record<NotificationSeverity, MessageDescriptor> = {
  [NotificationSeverity.Info]: msg`Info`,
  [NotificationSeverity.Warning]: msg`Warning`,
  [NotificationSeverity.Critical]: msg`Critical`,
};

const TARGET_ROUTE: Record<NotificationTargetKind, (id: string) => string> = {
  [NotificationTargetKind.TestRunGroup]: (id) => `/runs?id=${id}`,
  [NotificationTargetKind.Agent]: (id) => `/agents?id=${id}`,
  [NotificationTargetKind.OptimizationProposal]: (id) => `/proposals?id=${id}`,
};

export const severityBadgeVariant = (severity: NotificationSeverity): BadgeVariant =>
  SEVERITY_VARIANT[severity];

export const severityLabel = (severity: NotificationSeverity): MessageDescriptor =>
  SEVERITY_LABEL[severity];

/** Internal deep-link route for a notification's target, or null when it has none. */
export function targetRoute(kind: NotificationTargetKind | null, id: string | null): string | null {
  if (!kind || !id) return null;
  return TARGET_ROUTE[kind](id);
}
