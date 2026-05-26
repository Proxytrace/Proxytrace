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

// Tone → foreground text-class. Each maps byte-identically to the token the
// previous `style={{ color: 'var(--…)' }}` set (accent→accent-primary, etc.).
// `text-*` and `bg-*` of the same token both resolve to the same CSS variable,
// so use TONE_TEXT for color and TONE_DOT_BG for solid dots.
export const TONE_TEXT: Record<DisplayTone, string> = {
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-muted',
  secondary: 'text-secondary',
  teal: 'text-teal',
};

// Tone → solid background-class for status dots (replaces the dot's previous
// `style={{ background: 'var(--…)' }}`). Same underlying variable as TONE_TEXT.
export const TONE_DOT_BG: Record<DisplayTone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  muted: 'bg-muted',
  secondary: 'bg-secondary',
  teal: 'bg-teal',
};

// Tone → subtle tinted background-class. accent/success/danger have tokens;
// muted/secondary/teal use arbitrary values reproducing the previous exact CSS:
// muted/secondary = rgba(255,255,255,0.04), teal = color-mix(teal 14%).
export const TONE_SUBTLE_BG: Record<DisplayTone, string> = {
  accent: 'bg-accent-subtle',
  success: 'bg-success-subtle',
  danger: 'bg-danger-subtle',
  muted: 'bg-[rgba(255,255,255,0.04)]',
  secondary: 'bg-[rgba(255,255,255,0.04)]',
  teal: 'bg-[color-mix(in_srgb,var(--teal)_14%,transparent)]',
};

export interface KindMeta {
  label: string;
  // CSS-variable string — kept for genuinely runtime usages that build
  // `color-mix(in srgb, ${color} N%, transparent)` strings or feed `hoverGlow`.
  color: string;
  // Tailwind text-class for the leaf, replacing inline `style={{ color }}`.
  colorClass: string;
  // Tailwind solid-background-class, replacing inline `style={{ background }}`.
  bgClass: string;
}

export const KIND_META: Record<ProposalKind, KindMeta> = {
  [ProposalKind.SystemPrompt]: { label: 'Prompt rewrite', color: 'var(--accent-primary)', colorClass: 'text-accent',  bgClass: 'bg-accent' },
  [ProposalKind.Tool]:         { label: 'Tool update',    color: 'var(--success)',        colorClass: 'text-success', bgClass: 'bg-success' },
  [ProposalKind.ModelSwitch]:  { label: 'Model swap',     color: 'var(--teal)',           colorClass: 'text-teal',    bgClass: 'bg-teal' },
};

// Per-kind static tinted recipes, keyed by the finite ProposalKind enum so a
// missing member is a type error. These replace the previous inline
// `style={{ background: color-mix(in srgb, ${kind.color} N%, ...) }}` strings;
// each arbitrary value is byte-identical to what the CSS-var color-mix resolved
// to (accent-primary=#c9944a, success=#3daa6f, teal=#6b9eaa).

// Kind pill: tinted bg (9%) + tinted hairline border (20%). Pair with the
// kind's `colorClass` for the foreground text.
export const KIND_PILL_BG: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]: 'bg-[color-mix(in_srgb,var(--accent-primary)_9%,transparent)] border-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)]',
  [ProposalKind.Tool]:         'bg-[color-mix(in_srgb,var(--success)_9%,transparent)] border-[color-mix(in_srgb,var(--success)_20%,transparent)]',
  [ProposalKind.ModelSwitch]:  'bg-[color-mix(in_srgb,var(--teal)_9%,transparent)] border-[color-mix(in_srgb,var(--teal)_20%,transparent)]',
};

// Hero icon box: gradient fill (20%→7%), tinted border (27%) and glow shadow
// (13%). Pair with the kind's `colorClass` for the icon (currentColor) tint.
export const KIND_HERO_BOX: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]: 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_20%,transparent),color-mix(in_srgb,var(--accent-primary)_7%,transparent))] border border-[color-mix(in_srgb,var(--accent-primary)_27%,transparent)] shadow-[0_0_24px_color-mix(in_srgb,var(--accent-primary)_13%,transparent)]',
  [ProposalKind.Tool]:         'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--success)_20%,transparent),color-mix(in_srgb,var(--success)_7%,transparent))] border border-[color-mix(in_srgb,var(--success)_27%,transparent)] shadow-[0_0_24px_color-mix(in_srgb,var(--success)_13%,transparent)]',
  [ProposalKind.ModelSwitch]:  'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--teal)_20%,transparent),color-mix(in_srgb,var(--teal)_7%,transparent))] border border-[color-mix(in_srgb,var(--teal)_27%,transparent)] shadow-[0_0_24px_color-mix(in_srgb,var(--teal)_13%,transparent)]',
};

// Rationale block: faint tinted fill (4%) + left accent rule (2px, 40%).
export const KIND_RATIONALE: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]: 'bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)] border-l-2 border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)]',
  [ProposalKind.Tool]:         'bg-[color-mix(in_srgb,var(--success)_4%,transparent)] border-l-2 border-[color-mix(in_srgb,var(--success)_40%,transparent)]',
  [ProposalKind.ModelSwitch]:  'bg-[color-mix(in_srgb,var(--teal)_4%,transparent)] border-l-2 border-[color-mix(in_srgb,var(--teal)_40%,transparent)]',
};

export interface PriorityMeta {
  label: string;
  // Tailwind text-class for the leaf, replacing inline `style={{ color }}`.
  colorClass: string;
  // Tailwind solid-background-class for the priority dot (same underlying token).
  bgClass: string;
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  [Priority.Critical]: { label: 'Critical', colorClass: 'text-danger',    bgClass: 'bg-danger' },
  [Priority.High]:     { label: 'High',     colorClass: 'text-warn',      bgClass: 'bg-warn' },
  [Priority.Medium]:   { label: 'Medium',   colorClass: 'text-secondary', bgClass: 'bg-secondary' },
  [Priority.Low]:      { label: 'Low',      colorClass: 'text-muted',      bgClass: 'bg-muted' },
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
