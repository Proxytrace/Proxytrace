import { UNIT_MINUTES, fromIntervalMinutes, type IntervalUnit } from './interval';

/**
 * Schedule cadence model. A schedule fires at `anchorAt + k·interval` (the backend's phase model);
 * this module maps the friendly frequency picker (Hourly / Daily / Weekly / Custom) to that
 * `(intervalMinutes, anchorAt)` pair and back, and previews the next fire the same way the backend
 * advances it. All time-of-day values are **UTC** — the scheduler fires in UTC.
 */

export type Frequency = 'hourly' | 'daily' | 'weekly' | 'custom';

export const HOURLY_MINUTES = 60;
export const DAILY_MINUTES = 1440;
export const WEEKLY_MINUTES = 10080;

export const WEEKDAY_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Editable form state for the cadence picker. Only the fields relevant to the active frequency are read. */
export interface CadenceState {
  frequency: Frequency;
  /** Hourly: minute-of-hour, 0–59 (UTC). */
  minute: number;
  /** Daily / Weekly: time-of-day, 'HH:MM' (UTC). */
  time: string;
  /** Weekly: 0 (Sunday) – 6 (Saturday), UTC. */
  weekday: number;
  /** Custom: every `customValue` `customUnit`. */
  customValue: number;
  customUnit: IntervalUnit;
}

export function initialCadence(): CadenceState {
  return { frequency: 'daily', minute: 0, time: '02:00', weekday: 1, customValue: 6, customUnit: 'hours' };
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatHHMM(h: number, m: number): string {
  return `${pad2(clampInt(h, 0, 23))}:${pad2(clampInt(m, 0, 59))}`;
}

function parseHHMM(time: string): [number, number] {
  const [h, m] = time.split(':');
  return [clampInt(Number(h), 0, 23), clampInt(Number(m), 0, 59)];
}

/** Total interval, in minutes, implied by a cadence (the backend's `intervalMinutes`). */
export function cadenceIntervalMinutes(s: CadenceState): number {
  switch (s.frequency) {
    case 'hourly': return HOURLY_MINUTES;
    case 'daily': return DAILY_MINUTES;
    case 'weekly': return WEEKLY_MINUTES;
    case 'custom': return Math.max(1, clampInt(s.customValue, 1, 100_000)) * UNIT_MINUTES[s.customUnit];
  }
}

/**
 * The next UTC instant matching the cadence's phase, strictly after `now`. This becomes `anchorAt`;
 * because it is already in the future, the backend's first fire lands exactly on it.
 */
export function cadenceAnchor(s: CadenceState, now: Date): Date {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const day = now.getUTCDate();

  if (s.frequency === 'custom') {
    // No phase — the first run is one interval from now (legacy behaviour).
    return new Date(now.getTime());
  }

  if (s.frequency === 'hourly') {
    const d = new Date(Date.UTC(y, mo, day, now.getUTCHours(), clampInt(s.minute, 0, 59), 0, 0));
    if (d.getTime() <= now.getTime()) d.setUTCHours(d.getUTCHours() + 1);
    return d;
  }

  // daily + weekly share an HH:MM slot.
  const [h, m] = parseHHMM(s.time);
  const d = new Date(Date.UTC(y, mo, day, h, m, 0, 0));
  if (s.frequency === 'daily') {
    if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }

  // weekly
  const target = clampInt(s.weekday, 0, 6);
  let delta = (target - d.getUTCDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

/** Backend request params (`intervalMinutes`, ISO `anchorAt`) for a cadence at `now`. */
export function cadenceToSchedule(s: CadenceState, now: Date): { intervalMinutes: number; anchorAt: string } {
  return { intervalMinutes: cadenceIntervalMinutes(s), anchorAt: cadenceAnchor(s, now).toISOString() };
}

/** Reconstruct an editable cadence from a stored `(intervalMinutes, anchorAt)` for the edit form. */
export function scheduleToCadence(intervalMinutes: number, anchorAtIso: string): CadenceState {
  const base = initialCadence();
  const anchor = new Date(anchorAtIso);
  const valid = !Number.isNaN(anchor.getTime());
  const h = valid ? anchor.getUTCHours() : 2;
  const m = valid ? anchor.getUTCMinutes() : 0;

  if (intervalMinutes === HOURLY_MINUTES) return { ...base, frequency: 'hourly', minute: m };
  if (intervalMinutes === DAILY_MINUTES) return { ...base, frequency: 'daily', time: formatHHMM(h, m) };
  if (intervalMinutes === WEEKLY_MINUTES) {
    return { ...base, frequency: 'weekly', time: formatHHMM(h, m), weekday: valid ? anchor.getUTCDay() : 1 };
  }
  const { value, unit } = fromIntervalMinutes(intervalMinutes);
  return { ...base, frequency: 'custom', customValue: value, customUnit: unit };
}

/**
 * The first fire strictly after `now` for an anchored interval — the client mirror of the backend's
 * `AlignForward` (so the form preview matches what the server will store). Returns null on bad input.
 */
export function computeNextRun(anchorAtIso: string, intervalMinutes: number, now: Date): Date | null {
  const anchor = new Date(anchorAtIso).getTime();
  if (Number.isNaN(anchor) || intervalMinutes <= 0) return null;
  const intervalMs = intervalMinutes * 60_000;
  const t = now.getTime();
  if (anchor > t) return new Date(anchor);
  const steps = Math.floor((t - anchor) / intervalMs) + 1;
  return new Date(anchor + steps * intervalMs);
}
