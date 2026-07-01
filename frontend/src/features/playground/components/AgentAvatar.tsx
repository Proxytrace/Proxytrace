interface Props {
  seed: string;
  label: string;
  size?: number;
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gradientFor(seed: string): string {
  const h = hash(seed);
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + ((h >> 8) % 60)) % 360;
  // eslint-disable-next-line lingui/no-unlocalized-strings -- CSS gradient value, not UI copy
  return `linear-gradient(135deg, hsl(${hue1} 65% 52%), hsl(${hue2} 70% 38%))`;
}

export function AgentAvatar({ seed, label, size = 32 }: Props) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none tracking-[0.02em] shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_2px_6px_rgba(0,0,0,0.35)]"
      style={{
        width: size,
        height: size,
        background: gradientFor(seed),
        fontSize: Math.max(10, Math.round(size * 0.38)),
      }}
    >
      {initials}
    </span>
  );
}
