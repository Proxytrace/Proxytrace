export function fmtLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Browser-local date, "dd.MM.yyyy". App-wide canonical date format — 24-hour, day-first,
 * dot-separated. Do not re-implement date formatting in features; reuse these helpers.
 */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Date + 24h time to the minute, "dd.MM.yyyy HH:mm". For compact displays (chips, headers, pickers). */
export function fmtDateTimeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${fmtDate(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Date + 24h time with seconds, "dd.MM.yyyy HH:mm:ss". For log rows where exact time matters. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${fmtDateTimeShort(iso)}:${pad2(d.getSeconds())}`;
}

export function fmtRelative(iso: string): string {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return fmtDate(iso);
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function fmtCost(usd: number | null | undefined): string {
  if (usd == null) return '—';
  if (usd < 0.001) return '<$0.001';
  return `$${usd.toFixed(4)}`;
}
