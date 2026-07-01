/**
 * Pure time-range model shared by the time-range filter UI (Error Log, Traces). Kept
 * framework-free and unit-tested (`timeRange.spec.ts`) so the picker component stays a thin
 * presentational shell.
 *
 * A range is one of three shapes:
 *  - `all`      — no time bound (default).
 *  - `preset`   — a relative window ("last N"), resolved against *now* at query time so it
 *                 stays live across refetches instead of freezing at selection time.
 *  - `absolute` — explicit `from`/`to` ISO instants, either end optional (open-ended).
 */

import { msg } from '@lingui/core/macro';
import type { I18n, MessageDescriptor } from '@lingui/core';
import { fmtDateTimeShort } from './format';

export type TimeRangePreset = '15m' | '1h' | '6h' | '24h' | '7d' | '30d';

export type TimeRange =
  | { kind: 'all' }
  | { kind: 'preset'; preset: TimeRangePreset }
  | { kind: 'absolute'; from: string | null; to: string | null };

export const ALL_TIME: TimeRange = { kind: 'all' };

/** Current wall-clock time in ms. Isolated here so component render stays lint-pure. */
export function nowMs(): number {
  return Date.now();
}

/** Window length per preset, in milliseconds. */
const PRESET_MS: Record<TimeRangePreset, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
};

/**
 * Preset options in display order (drives the popover's relative list). Labels are
 * {@link MessageDescriptor}s — resolve at render with `i18n._()` (see TimeRangePicker).
 */
export const TIME_PRESETS: readonly { preset: TimeRangePreset; label: MessageDescriptor }[] = [
  { preset: '15m', label: msg`Last 15 minutes` },
  { preset: '1h', label: msg`Last hour` },
  { preset: '6h', label: msg`Last 6 hours` },
  { preset: '24h', label: msg`Last 24 hours` },
  { preset: '7d', label: msg`Last 7 days` },
  { preset: '30d', label: msg`Last 30 days` },
];

const PRESET_LABEL: Record<TimeRangePreset, MessageDescriptor> = Object.fromEntries(
  TIME_PRESETS.map(p => [p.preset, p.label]),
) as Record<TimeRangePreset, MessageDescriptor>;

/** True when the range narrows results (i.e. anything other than the default "all time"). */
export function isRangeActive(range: TimeRange): boolean {
  if (range.kind === 'all') return false;
  if (range.kind === 'absolute') return range.from != null || range.to != null;
  return true;
}

/**
 * Resolves a range to the concrete `from`/`to` ISO instants sent to the API. Presets resolve
 * relative to `now` (injectable for tests); omitted ends are left off the result entirely.
 */
/**
 * The concrete `from`..`to` instants a preset spans right now (upper bound = `now`). Used to
 * pre-fill the custom From/To inputs when a preset is picked, so the chosen window is visible
 * and editable. `resolveRange` is what actually feeds the query (presets stay open-ended there).
 */
export function presetWindow(preset: TimeRangePreset, now: number = Date.now()): { from: string; to: string } {
  return { from: new Date(now - PRESET_MS[preset]).toISOString(), to: new Date(now).toISOString() };
}

export function resolveRange(range: TimeRange, now: number = Date.now()): { from?: string; to?: string } {
  switch (range.kind) {
    case 'all':
      return {};
    case 'preset':
      return { from: new Date(now - PRESET_MS[range.preset]).toISOString() };
    case 'absolute': {
      const out: { from?: string; to?: string } = {};
      if (range.from) out.from = range.from;
      if (range.to) out.to = range.to;
      return out;
    }
  }
}

/**
 * Human label for the picker's trigger button. Uses the app-wide compact datetime format.
 *
 * Pass the active `i18n` (from `useLingui`) so the label resolves in the viewer's language at
 * render. When omitted, the English source text is used — this keeps the pure model formattable
 * in unit tests and any non-React caller without needing a live catalog.
 */
export function formatRangeLabel(range: TimeRange, i18n?: I18n): string {
  const tr = (d: MessageDescriptor): string => (i18n ? i18n._(d) : d.message ?? d.id);
  switch (range.kind) {
    case 'all':
      return tr(msg`All time`);
    case 'preset':
      return tr(PRESET_LABEL[range.preset]);
    case 'absolute': {
      const from = range.from ? fmtDateTimeShort(range.from) : tr(msg`Any`);
      const to = range.to ? fmtDateTimeShort(range.to) : tr(msg`now`);
      return `${from} → ${to}`;
    }
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant → `datetime-local` input value ("YYYY-MM-DDTHH:mm") in the viewer's local zone. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` input value (local zone) → ISO instant, or null when blank/invalid. */
export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
