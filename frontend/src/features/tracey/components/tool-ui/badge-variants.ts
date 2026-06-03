import type { BadgeVariant } from '../../../../components/ui/Badge';
import { Priority, ProposalStatus, TestRunStatus, TheoryStatus } from '../../../../api/models';

/** Status → Badge variant maps shared by the single-entity cards and their list counterparts. */

export const RUN_STATUS_VARIANT: Record<TestRunStatus, BadgeVariant> = {
  [TestRunStatus.Completed]: 'success',
  [TestRunStatus.Failed]: 'danger',
  [TestRunStatus.Running]: 'accent',
  [TestRunStatus.Pending]: 'neutral',
  [TestRunStatus.Cancelled]: 'neutral',
};

export const PROPOSAL_STATUS_VARIANT: Record<ProposalStatus, BadgeVariant> = {
  [ProposalStatus.Accepted]: 'success',
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
