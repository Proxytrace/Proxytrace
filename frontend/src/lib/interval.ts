/**
 * Turns a schedule interval expressed in minutes into a compact cadence label,
 * preferring the largest whole unit: 30 → "Every 30m", 60 → "Every 1h",
 * 1440 → "Every 1d", 2880 → "Every 2d", 90 → "Every 90m". Falls back to minutes
 * when the value isn't a whole number of hours/days.
 */
export function formatInterval(minutes: number): string {
  if (minutes <= 0) return 'Every —';
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `Every ${days}d`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `Every ${hours}h`;
  }
  return `Every ${minutes}m`;
}

export type IntervalUnit = 'minutes' | 'hours' | 'days';

/** Multiplier from an interval unit to minutes. */
export const UNIT_MINUTES: Record<IntervalUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

/** Composes a value + unit into total minutes (the backend's `intervalMinutes`). */
export function toIntervalMinutes(value: number, unit: IntervalUnit): number {
  return value * UNIT_MINUTES[unit];
}

/**
 * Decomposes total minutes back into the largest whole {value, unit} for editing,
 * inverse of {@link toIntervalMinutes}: 1440 → {1, days}, 90 → {90, minutes}.
 */
export function fromIntervalMinutes(minutes: number): { value: number; unit: IntervalUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { value: minutes / 1440, unit: 'days' };
  if (minutes > 0 && minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' };
  return { value: minutes, unit: 'minutes' };
}
