import { beforeAll, describe, expect, it } from 'vitest';
import type { TestRunDto } from '../../api/models';
import { Priority, ProposalKind, ProposalStatus, TestRunStatus } from '../../api/models';
import { i18n } from '../../i18n';
import {
  groupCaseTotals,
  httpStatusVariant,
  priorityLabel,
  proposalKindLabel,
  proposalStatusLabel,
  proposalStatusVariant,
  runStatusLabel,
  runStatusVariant,
} from './targetPreviewMeta';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

function run(totalCases: number, passedCases: number): TestRunDto {
  return { totalCases, passedCases } as TestRunDto;
}

describe('targetPreviewMeta', () => {
  it('labels and colours run status', () => {
    expect(i18n._(runStatusLabel(TestRunStatus.Completed))).toBe('Completed');
    expect(runStatusVariant(TestRunStatus.Failed)).toBe('danger');
    expect(runStatusVariant(TestRunStatus.Running)).toBe('accent');
  });

  it('labels and colours proposal status, kind and priority', () => {
    expect(i18n._(proposalStatusLabel(ProposalStatus.Adopted))).toBe('Adopted');
    expect(proposalStatusVariant(ProposalStatus.Rejected)).toBe('danger');
    expect(i18n._(proposalKindLabel(ProposalKind.ModelSwitch))).toBe('Model switch');
    expect(i18n._(priorityLabel(Priority.Critical))).toBe('Critical');
  });

  it('colours an HTTP status by class', () => {
    expect(httpStatusVariant(200)).toBe('success');
    expect(httpStatusVariant(429)).toBe('warn');
    expect(httpStatusVariant(500)).toBe('danger');
  });

  it('sums case totals across a group runs', () => {
    expect(groupCaseTotals([run(10, 8), run(10, 6)])).toEqual({ passed: 14, total: 20 });
  });

  it('returns null when a group has no cases yet', () => {
    expect(groupCaseTotals([])).toBeNull();
    expect(groupCaseTotals([run(0, 0)])).toBeNull();
  });
});
