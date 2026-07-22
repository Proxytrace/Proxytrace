import { agentColor } from '../../../lib/colors';

interface Props {
  seed: string;
  label: string;
  size?: number;
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
      className="inline-flex items-center justify-center rounded-full font-semibold text-[var(--accent-ink)] shrink-0 select-none tracking-[0.02em]"
      style={{
        width: size,
        height: size,
        background: agentColor(seed),
        fontSize: Math.max(10, Math.round(size * 0.38)),
      }}
    >
      {initials}
    </span>
  );
}
