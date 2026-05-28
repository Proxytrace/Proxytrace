import type { OptimizationProposalDto } from '../../api/models';
import { Priority, ProposalKind, ProposalStatus, TestRunStatus } from '../../api/models';

export type DisplayTone = 'accent' | 'success' | 'danger' | 'muted' | 'secondary' | 'teal';

export interface DisplayStatus {
  label: string;
  tone: DisplayTone;
  pulse: boolean;
}

export function displayStatus(dto: OptimizationProposalDto): DisplayStatus {
  if (dto.status === ProposalStatus.Accepted) return { label: 'Promoted', tone: 'success', pulse: false };
  if (dto.status === ProposalStatus.Rejected) return { label: 'Dismissed', tone: 'muted', pulse: false };

  const ab = dto.abTestRun;
  if (!ab) return { label: 'Pending review', tone: 'accent', pulse: false };

  switch (ab.status) {
    case TestRunStatus.Pending:   return { label: 'A/B queued', tone: 'teal', pulse: true };
    case TestRunStatus.Running:   return { label: 'A/B running', tone: 'teal', pulse: true };
    case TestRunStatus.Completed: return { label: 'Ready to promote', tone: 'success', pulse: false };
    case TestRunStatus.Failed:    return { label: 'A/B failed', tone: 'danger', pulse: false };
    case TestRunStatus.Cancelled: return { label: 'A/B cancelled', tone: 'muted', pulse: false };
    default:                      return { label: 'Pending review', tone: 'accent', pulse: false };
  }
}

export function isTerminal(dto: OptimizationProposalDto): boolean {
  return dto.status === ProposalStatus.Accepted || dto.status === ProposalStatus.Rejected;
}

export const TONE_COLOR: Record<DisplayTone, string> = {
  accent: 'var(--accent-primary)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  muted: 'var(--text-muted)',
  secondary: 'var(--text-secondary)',
  teal: 'var(--teal)',
};

export const TONE_SUBTLE: Record<DisplayTone, string> = {
  accent: 'var(--accent-subtle)',
  success: 'var(--success-subtle)',
  danger: 'var(--danger-subtle)',
  muted: 'rgba(255,255,255,0.04)',
  secondary: 'rgba(255,255,255,0.04)',
  teal: 'color-mix(in srgb, var(--teal) 14%, transparent)',
};

// Tailwind class maps mirroring TONE_COLOR / TONE_SUBTLE — preferred for static
// tone lookups so the JSX stays free of style={{}} (BEST_PRACTICES §7/§13).
export const TONE_TEXT_CLS: Record<DisplayTone, string> = {
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-muted',
  secondary: 'text-secondary',
  teal: 'text-teal',
};

export const TONE_BG_SUBTLE_CLS: Record<DisplayTone, string> = {
  accent: 'bg-accent-subtle',
  success: 'bg-success-subtle',
  danger: 'bg-danger-subtle',
  muted: 'bg-[rgba(255,255,255,0.04)]',
  secondary: 'bg-[rgba(255,255,255,0.04)]',
  teal: 'bg-[color-mix(in_srgb,var(--teal)_14%,transparent)]',
};

export const TONE_BG_CLS: Record<DisplayTone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  muted: 'bg-muted',
  secondary: 'bg-secondary',
  teal: 'bg-teal',
};

export interface KindMeta {
  label: string;
  color: string;
}

export const KIND_META: Record<ProposalKind, KindMeta> = {
  [ProposalKind.SystemPrompt]: { label: 'Prompt rewrite', color: 'var(--accent-primary)' },
  [ProposalKind.Tool]:         { label: 'Tool update',    color: 'var(--success)' },
  [ProposalKind.ModelSwitch]:  { label: 'Model swap',     color: 'var(--teal)' },
};

export interface PriorityMeta {
  label: string;
  color: string;
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  [Priority.Critical]: { label: 'Critical', color: 'var(--danger)' },
  [Priority.High]:     { label: 'High',     color: 'var(--warn)' },
  [Priority.Medium]:   { label: 'Medium',   color: 'var(--text-secondary)' },
  [Priority.Low]:      { label: 'Low',      color: 'var(--text-muted)' },
};

export function titleFromRationale(rationale: string): string {
  const first = rationale.split(/[.!?]/)[0]?.trim();
  return first && first.length > 0 ? first : rationale;
}

export function formatPercentDelta(value: number | null | undefined): string {
  if (value == null) return '—';
  const pts = Math.round(value * 100);
  if (pts === 0) return '0pt';
  return `${pts > 0 ? '+' : '−'}${Math.abs(pts)}pt`;
}

export function formatCostDelta(eur: number | null | undefined): string {
  if (eur == null) return '—';
  if (eur === 0) return '€0';
  const abs = Math.abs(eur);
  const formatted = abs < 0.001 ? '<€0.001' : `€${abs.toFixed(4)}`;
  return `${eur > 0 ? '+' : '−'}${formatted}`;
}

export function formatLatencyDelta(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms === 0) return '0ms';
  const abs = Math.abs(ms);
  const text = abs < 1000 ? `${Math.round(abs)}ms` : `${(abs / 1000).toFixed(1)}s`;
  return `${ms > 0 ? '+' : '−'}${text}`;
}

export function deltaTone(value: number | null | undefined, lowerIsBetter: boolean): DisplayTone {
  if (value == null || value === 0) return 'muted';
  const positive = lowerIsBetter ? value < 0 : value > 0;
  return positive ? 'success' : 'danger';
}
