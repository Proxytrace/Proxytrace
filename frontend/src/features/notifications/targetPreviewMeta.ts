// Pure label/variant maps and derivations for the notification target previews.
// No JSX, no I/O — unit-tested in targetPreviewMeta.spec.ts.

import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { Priority, ProposalKind, ProposalStatus, TestRunStatus } from '../../api/models';
import type { TestRunDto } from '../../api/models';
import type { BadgeVariant } from '../../components/ui/Badge';

// The backend enums are English identifiers; a badge showing one to the user resolves through
// these maps rather than rendering the raw value.

const RUN_STATUS_LABEL: Record<TestRunStatus, MessageDescriptor> = {
  [TestRunStatus.Pending]: msg`Pending`,
  [TestRunStatus.Running]: msg`Running`,
  [TestRunStatus.Completed]: msg`Completed`,
  [TestRunStatus.Failed]: msg`Failed`,
  [TestRunStatus.Cancelled]: msg`Cancelled`,
};

const RUN_STATUS_VARIANT: Record<TestRunStatus, BadgeVariant> = {
  [TestRunStatus.Pending]: 'neutral',
  [TestRunStatus.Running]: 'accent',
  [TestRunStatus.Completed]: 'success',
  [TestRunStatus.Failed]: 'danger',
  [TestRunStatus.Cancelled]: 'neutral',
};

const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, MessageDescriptor> = {
  [ProposalStatus.Draft]: msg`Draft`,
  [ProposalStatus.Accepted]: msg`Accepted`,
  [ProposalStatus.Rejected]: msg`Rejected`,
  [ProposalStatus.Adopted]: msg`Adopted`,
};

const PROPOSAL_STATUS_VARIANT: Record<ProposalStatus, BadgeVariant> = {
  [ProposalStatus.Draft]: 'neutral',
  [ProposalStatus.Accepted]: 'success',
  [ProposalStatus.Rejected]: 'danger',
  [ProposalStatus.Adopted]: 'success',
};

const PROPOSAL_KIND_LABEL: Record<ProposalKind, MessageDescriptor> = {
  [ProposalKind.SystemPrompt]: msg`System prompt`,
  [ProposalKind.Tool]: msg`Tool`,
  [ProposalKind.ModelSwitch]: msg`Model switch`,
};

const PRIORITY_LABEL: Record<Priority, MessageDescriptor> = {
  [Priority.Low]: msg`Low`,
  [Priority.Medium]: msg`Medium`,
  [Priority.High]: msg`High`,
  [Priority.Critical]: msg`Critical`,
};

export const runStatusLabel = (status: TestRunStatus): MessageDescriptor => RUN_STATUS_LABEL[status];
export const runStatusVariant = (status: TestRunStatus): BadgeVariant => RUN_STATUS_VARIANT[status];
export const proposalStatusLabel = (status: ProposalStatus): MessageDescriptor => PROPOSAL_STATUS_LABEL[status];
export const proposalStatusVariant = (status: ProposalStatus): BadgeVariant => PROPOSAL_STATUS_VARIANT[status];
export const proposalKindLabel = (kind: ProposalKind): MessageDescriptor => PROPOSAL_KIND_LABEL[kind];
export const priorityLabel = (priority: Priority): MessageDescriptor => PRIORITY_LABEL[priority];

/** Badge variant for a captured call's HTTP status — the trace preview's health at a glance. */
export function httpStatusVariant(httpStatus: number): BadgeVariant {
  if (httpStatus >= 500) return 'danger';
  if (httpStatus >= 400) return 'warn';
  return 'success';
}

/**
 * Total and passed case counts across a run group's runs. Returns null when the group has no
 * cases yet (nothing meaningful to show as a pass rate).
 */
export function groupCaseTotals(runs: readonly TestRunDto[]): { passed: number; total: number } | null {
  const total = runs.reduce((sum, run) => sum + run.totalCases, 0);
  if (total === 0) return null;
  return { passed: runs.reduce((sum, run) => sum + run.passedCases, 0), total };
}
