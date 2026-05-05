export function sparklinePath(values: number[], w: number, h: number): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xs = values.map((_, i) => (i / (values.length - 1)) * w);
  const ys = values.map(v => h - ((v - min) / range) * h);
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
}

export function areaPath(values: number[], w: number, h: number): string {
  if (values.length < 2) return '';
  const line = sparklinePath(values, w, h);
  const lastX = w;
  return `${line} L${lastX},${h} L0,${h} Z`;
}

export function histogramBuckets(
  values: number[],
  bucketCount: number,
): { x: number; count: number; label: string }[] {
  if (!values.length) return Array.from({ length: bucketCount }, (_, i) => ({ x: i, count: 0, label: '' }));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min || 1) / bucketCount;
  const counts = Array(bucketCount).fill(0);
  for (const v of values) {
    const i = Math.min(Math.floor((v - min) / step), bucketCount - 1);
    counts[i]++;
  }
  return counts.map((count, i) => ({
    x: i,
    count,
    label: `${Math.round(min + i * step)}–${Math.round(min + (i + 1) * step)}`,
  }));
}

export function normalizeToFit(values: number[], h: number): number[] {
  const max = Math.max(...values, 1);
  return values.map(v => (v / max) * h);
}
