import { type EvaluationScore } from '../../../api/models';
import { scoreColor, scoreNumber, scoreAnchor } from '../testBenchMeta';

/** Circular 1–5 score gauge with the numeral + anchor label at its center. */
export function RadialScore({ score, size = 150, stroke = 12 }: {
  score: EvaluationScore | null;
  size?: number;
  stroke?: number;
}) {
  const color = scoreColor(score);
  const n = scoreNumber(score);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (n != null ? n / 5 : 0) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-[var(--bg-card-2)]" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(.2,.7,.3,1)] motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-0.5 font-mono">
          <span className="font-bold leading-none" style={{ fontSize: size * 0.36, color }}>{n ?? '—'}</span>
          {n != null && <span className="text-muted font-semibold" style={{ fontSize: size * 0.13 }}>/5</span>}
        </div>
        <span className="font-bold uppercase tracking-[0.06em] mt-1" style={{ fontSize: size * 0.1, color }}>
          {scoreAnchor(score)}
        </span>
      </div>
    </div>
  );
}
