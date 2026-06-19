import { describe, expect, it } from 'vitest';
import { NotificationSeverity, NotificationTargetKind } from '../../api/models';
import { severityBadgeVariant, severityLabel, targetRoute } from './notificationsMeta';

describe('notificationsMeta', () => {
  it('maps severity to a badge variant', () => {
    expect(severityBadgeVariant(NotificationSeverity.Info)).toBe('accent');
    expect(severityBadgeVariant(NotificationSeverity.Warning)).toBe('warn');
    expect(severityBadgeVariant(NotificationSeverity.Critical)).toBe('danger');
  });

  it('labels severity', () => {
    expect(severityLabel(NotificationSeverity.Critical)).toBe('Critical');
  });

  it('builds deep-link routes for each target kind', () => {
    expect(targetRoute(NotificationTargetKind.TestRunGroup, 'g1')).toBe('/runs?id=g1');
    expect(targetRoute(NotificationTargetKind.Agent, 'a1')).toBe('/agents?id=a1');
    expect(targetRoute(NotificationTargetKind.OptimizationProposal, 'p1')).toBe('/proposals?id=p1');
  });

  it('returns null when target is incomplete', () => {
    expect(targetRoute(null, 'g1')).toBeNull();
    expect(targetRoute(NotificationTargetKind.TestRunGroup, null)).toBeNull();
  });
});
