interface AvatarProps {
  initials: string;
  color: string;
  className?: string;
}

export function Avatar({ initials, color, className = '' }: AvatarProps) {
  return (
    <div
      className={`flex items-center justify-center shrink-0 font-bold text-white ${className}`}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 80%, transparent), color-mix(in srgb, ${color} 53%, transparent))`,
      }}
    >
      {initials}
    </div>
  );
}
