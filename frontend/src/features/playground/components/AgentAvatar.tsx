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

function fillFor(seed: string): string {
  const hue = hash(seed) % 360;
  // eslint-disable-next-line lingui/no-unlocalized-strings -- CSS color value, not UI copy
  return `hsl(${hue} 55% 45%)`;
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
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none tracking-[0.02em]"
      style={{
        width: size,
        height: size,
        background: fillFor(seed),
        fontSize: Math.max(10, Math.round(size * 0.38)),
      }}
    >
      {initials}
    </span>
  );
}
