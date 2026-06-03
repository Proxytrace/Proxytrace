// Pure display constants for optimization theories. No JSX, no I/O.

import { TheorySource, TheoryStatus } from '../../api/models';
import type { DisplayTone } from './shared';

export interface TheoryStatusMeta {
  label: string;
  tone: DisplayTone;
  pulse: boolean;
}

export const THEORY_STATUS_META: Record<TheoryStatus, TheoryStatusMeta> = {
  [TheoryStatus.Proposed]: { label: 'Proposed', tone: 'accent', pulse: false },
  [TheoryStatus.Validating]: { label: 'Validating', tone: 'teal', pulse: true },
  [TheoryStatus.Validated]: { label: 'Validated', tone: 'success', pulse: false },
  [TheoryStatus.Invalidated]: { label: 'Invalidated', tone: 'muted', pulse: false },
};

export const THEORY_SOURCE_LABEL: Record<TheorySource, string> = {
  [TheorySource.Optimizer]: 'Optimizer',
  [TheorySource.User]: 'You',
  [TheorySource.TraceyAi]: 'Tracey AI',
  [TheorySource.External]: 'External',
};
