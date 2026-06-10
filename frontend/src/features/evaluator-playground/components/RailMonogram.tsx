import { evaluatorColor, tint } from '../../../lib/colors';

/** Rounded-square initial tile for an evaluator, tinted by its kind color. */
export function RailMonogram({ name, kind, size = 28 }: { name: string; kind: string; size?: number }) {
  const color = evaluatorColor(kind);
  const initial = name.trim()[0]?.toUpperCase() ?? '?';
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center shrink-0 font-bold leading-none"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        fontSize: size * 0.42,
        background: tint(color, 12),
        color,
        boxShadow: `inset 0 0 0 1px ${tint(color, 24)}`,
      }}
    >
      {initial}
    </span>
  );
}
