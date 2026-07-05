export interface GaugeSegment { x1: number; y1: number; x2: number; y2: number; color: string; active: boolean; glow: boolean; }
export interface SegmentedGaugeData { segments: GaugeSegment[]; cx: number; cy: number; }

export function computeSegmentedGauge(value: number, size: number): SegmentedGaugeData {
  const SEGS = 44;
  const filled = Math.round((value / 100) * SEGS);
  const s = size / 220;
  const r = size / 2 - 16 * s - 6;
  const cx = size / 2, cy = size / 2;
  const startAngle = -210, endAngle = 30;
  const range = endAngle - startAngle;
  const armLen = 7 * s + 1;
  const segments: GaugeSegment[] = Array.from({ length: SEGS }, (_, i) => {
    const t = i / (SEGS - 1);
    const ang = (startAngle + t * range) * Math.PI / 180;
    const active = i < filled;
    const color = t < 0.35 ? 'var(--warn)' : t < 0.7 ? 'var(--accent-primary)' : 'var(--success)';
    return {
      x1: cx + Math.cos(ang) * (r - armLen), y1: cy + Math.sin(ang) * (r - armLen),
      x2: cx + Math.cos(ang) * (r + armLen), y2: cy + Math.sin(ang) * (r + armLen),
      color, active, glow: active && i > filled - 4,
    };
  });
  return { segments, cx, cy };
}
