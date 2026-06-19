import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import type { RuntimeBreakdownDto } from '../../../../api/models';

export const SECTION_LABEL = 'text-title font-semibold text-secondary mb-2.5';

export const ROLE_COLOR: Record<string, string> = {
  system: 'var(--accent-primary)',
  user: 'var(--teal)',
  assistant: 'var(--success)',
  tool: 'var(--text-muted)',
};

export const RUNTIME_SEGMENTS: { key: keyof RuntimeBreakdownDto; label: MessageDescriptor; color: string }[] = [
  { key: 'ttft', label: msg`TTFT`, color: 'var(--teal)' },
  { key: 'gen', label: msg`Gen`, color: 'var(--accent-primary)' },
  { key: 'tools', label: msg`Tools`, color: 'var(--success)' },
  { key: 'judge', label: msg`Judge`, color: 'var(--warn)' },
];
