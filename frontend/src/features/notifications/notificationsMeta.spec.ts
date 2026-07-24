import { beforeAll, describe, expect, it } from 'vitest';
import {
  NotificationKind,
  NotificationSeverity,
  NotificationStatus,
  NotificationTargetKind,
} from '../../api/models';
import { i18n } from '../../i18n';
import { kindLabel, severityBadgeVariant, severityLabel, statusLabel, targetRoute } from './notificationsMeta';

// Activate an empty catalog so i18n._() resolves MessageDescriptors to their source strings.
beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

describe('notificationsMeta', () => {
  it('maps severity to a badge variant', () => {
    expect(severityBadgeVariant(NotificationSeverity.Info)).toBe('accent');
    expect(severityBadgeVariant(NotificationSeverity.Warning)).toBe('warn');
    expect(severityBadgeVariant(NotificationSeverity.Critical)).toBe('danger');
  });

  it('labels severity', () => {
    expect(i18n._(severityLabel(NotificationSeverity.Critical))).toBe('Critical');
  });

  it('labels kind and status', () => {
    expect(i18n._(kindLabel(NotificationKind.Anomaly))).toBe('Anomaly');
    expect(i18n._(kindLabel(NotificationKind.ProposalReady))).toBe('Proposal ready');
    expect(i18n._(statusLabel(NotificationStatus.Unread))).toBe('Unread');
    expect(i18n._(statusLabel(NotificationStatus.Dismissed))).toBe('Dismissed');
  });

  it('builds deep-link routes for each target kind', () => {
    expect(targetRoute(NotificationTargetKind.TestRunGroup, 'g1')).toBe('/runs?id=g1');
    expect(targetRoute(NotificationTargetKind.Agent, 'a1')).toBe('/agents?id=a1');
    expect(targetRoute(NotificationTargetKind.OptimizationProposal, 'p1')).toBe('/proposals?id=p1');
    // AgentCall notifications are produced in production (blocked calls, custom-detector reviews);
    // a missing entry here used to throw and white-screen the whole app from the topbar.
    expect(targetRoute(NotificationTargetKind.AgentCall, 'c1')).toBe('/traces?focus=c1');
  });

  it('encodes the id into the query string', () => {
    expect(targetRoute(NotificationTargetKind.Agent, 'a 1&x=2')).toBe('/agents?id=a%201%26x%3D2');
  });

  it('returns null for an unknown target kind instead of throwing', () => {
    const unknown = 'SomethingNewer' as NotificationTargetKind;
    expect(targetRoute(unknown, 'x1')).toBeNull();
  });

  it('returns null when target is incomplete', () => {
    expect(targetRoute(null, 'g1')).toBeNull();
    expect(targetRoute(NotificationTargetKind.TestRunGroup, null)).toBeNull();
  });
});
