interface AvatarProps {
  initials: string;
  color: string;
  className?: string;
}

export function Avatar({ initials, color, className = '' }: AvatarProps) {
  return (
    <div
      className={`flex items-center justify-center shrink-0 font-bold text-[var(--accent-ink)] ${className}`}
      style={{
        background: color,
      }}
    >
      {initials}
    </div>
  );
}
