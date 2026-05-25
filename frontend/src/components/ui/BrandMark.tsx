interface BrandMarkProps {
  /** Rendered pixel size of the square mark. */
  size?: number;
}

/**
 * Proxytrace "Probe" brand mark — a node with concentric trace rings on a
 * tinted chip. Gold core/outer rings, muted-teal dashed trace ring.
 */
export function BrandMark({ size = 30 }: BrandMarkProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[27%] bg-card-2 shadow-[0_3px_12px_-3px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 30 30" fill="none" className="block">
        {/* outer ring */}
        <circle cx="15" cy="15" r="10.5" className="stroke-accent opacity-[0.28]" strokeWidth="0.7" />
        {/* middle ring */}
        <circle cx="15" cy="15" r="7.5" className="stroke-accent opacity-[0.55]" strokeWidth="0.8" />
        {/* dashed trace ring */}
        <circle cx="15" cy="15" r="5" className="stroke-teal" strokeWidth="1.1" strokeDasharray="1.6 1.8" />
        {/* core */}
        <circle cx="15" cy="15" r="2.6" className="fill-accent" />
      </svg>
    </span>
  );
}
