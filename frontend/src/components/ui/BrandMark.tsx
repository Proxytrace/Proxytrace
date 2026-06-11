interface BrandMarkProps {
  /** Rendered pixel size of the square mark. */
  size?: number;
}

/**
 * Proxytrace "Scope" brand mark — a gold trace pulse over a faint graticule
 * line with a teal live cursor, on a tinted chip. Mirrors public/icon.svg.
 */
export function BrandMark({ size = 30 }: BrandMarkProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[27%] bg-card-2 shadow-[0_3px_12px_-3px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 30 30" fill="none" className="block">
        {/* graticule baseline */}
        <path d="M4 15 H26" className="stroke-teal opacity-30" strokeWidth="0.9" />
        {/* trace pulse */}
        <path
          d="M4 15 H8.6 L11.9 8.8 L17 21.2 L20.2 15 H23.2"
          className="stroke-accent"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* live cursor */}
        <circle cx="25.2" cy="15" r="2.1" className="fill-teal" />
      </svg>
    </span>
  );
}
