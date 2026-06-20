// Pure display constants for optimization theories. No JSX, no I/O.

import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { TheorySource, TheoryStatus } from '../../api/models';
import type { DisplayTone } from './shared';

export interface TheoryStatusMeta {
  label: MessageDescriptor;
  tone: DisplayTone;
  pulse: boolean;
}

export const THEORY_STATUS_META: Record<TheoryStatus, TheoryStatusMeta> = {
  [TheoryStatus.Proposed]: { label: msg`Proposed`, tone: 'accent', pulse: false },
  [TheoryStatus.Validating]: { label: msg`Validating`, tone: 'teal', pulse: true },
  [TheoryStatus.Validated]: { label: msg`Validated`, tone: 'success', pulse: false },
  [TheoryStatus.Invalidated]: { label: msg`Invalidated`, tone: 'muted', pulse: false },
};

export const THEORY_SOURCE_LABEL: Record<TheorySource, MessageDescriptor> = {
  [TheorySource.Optimizer]: msg`Optimizer`,
  [TheorySource.User]: msg`You`,
  [TheorySource.TraceyAi]: msg`Tracey AI`,
  [TheorySource.External]: msg`External`,
};
