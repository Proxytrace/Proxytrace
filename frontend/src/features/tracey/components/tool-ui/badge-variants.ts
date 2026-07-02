import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import type { BadgeVariant } from '../../../../components/ui/Badge';
import { Priority, ProposalStatus, TestRunStatus, TheoryStatus } from '../../../../api/models';

/**
 * Status → Badge variant and localized-label maps shared by the single-entity cards, their list
 * counterparts, and the await rows. Labels exist because the backend enums are English
 * identifiers — any badge showing them to the user must resolve through these maps, never render
 * the raw value.
 */

export const RUN_STATUS_VARIANT: Record<TestRunStatus, BadgeVariant> = {
  [TestRunStatus.Completed]: 'success',
  [TestRunStatus.Failed]: 'danger',
  [TestRunStatus.Running]: 'accent',
  [TestRunStatus.Pending]: 'neutral',
  [TestRunStatus.Cancelled]: 'neutral',
};

export const RUN_STATUS_LABEL: Record<TestRunStatus, MessageDescriptor> = {
  [TestRunStatus.Completed]: msg`Completed`,
  [TestRunStatus.Failed]: msg`Failed`,
  [TestRunStatus.Running]: msg`Running`,
  [TestRunStatus.Pending]: msg`Pending`,
  [TestRunStatus.Cancelled]: msg`Cancelled`,
};

export const PROPOSAL_STATUS_VARIANT: Record<ProposalStatus, BadgeVariant> = {
  [ProposalStatus.Accepted]: 'success',
  [ProposalStatus.Adopted]: 'success',
  [ProposalStatus.Rejected]: 'danger',
  [ProposalStatus.Draft]: 'neutral',
};

export const PRIORITY_VARIANT: Record<Priority, BadgeVariant> = {
  [Priority.Critical]: 'danger',
  [Priority.High]: 'warn',
  [Priority.Medium]: 'accent',
  [Priority.Low]: 'neutral',
};

export const THEORY_STATUS_VARIANT: Record<TheoryStatus, BadgeVariant> = {
  [TheoryStatus.Proposed]: 'accent',
  [TheoryStatus.Validating]: 'accent',
  [TheoryStatus.Validated]: 'success',
  [TheoryStatus.Invalidated]: 'neutral',
};

export const THEORY_STATUS_LABEL: Record<TheoryStatus, MessageDescriptor> = {
  [TheoryStatus.Proposed]: msg`Queued`,
  [TheoryStatus.Validating]: msg`A/B testing`,
  [TheoryStatus.Validated]: msg`Improved`,
  [TheoryStatus.Invalidated]: msg`Rejected`,
};
