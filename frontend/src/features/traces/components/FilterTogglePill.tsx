import type { ReactNode } from 'react';
import { SwitchPill } from '../../../components/ui/SwitchPill';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  label: ReactNode;
  testId?: string;
}

/**
 * Traces-toolbar labeled toggle. Thin wrapper over the shared {@link SwitchPill} primitive that
 * keeps the toolbar's `testId` prop name; the track + inline-label recipe lives in SwitchPill.
 */
export function FilterTogglePill({ checked, onChange, title, label, testId }: Props) {
  return <SwitchPill checked={checked} onChange={onChange} title={title} label={label} data-testid={testId} />;
}
