import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { Locale } from '../../i18n';

/**
 * Country flags for the language picker. Unlike the glyphs in this module, flags are intrinsically
 * multicolor — the national colors below are graphic data (like a chart's series colors), not theme
 * tokens, so they're hardcoded here on purpose and live in this one place rather than inline in a
 * feature file. Each is authored on a 24×16 canvas and rendered decoratively (`aria-hidden`); the
 * adjacent language name carries the meaning for assistive tech.
 */
const FLAGS: Record<Locale, ReactNode> = {
  en: (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 L24 16 M24 0 L0 16" stroke="#FFFFFF" strokeWidth="3.2" />
      <path d="M0 0 L24 16 M24 0 L0 16" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M12 0 V16 M0 8 H24" stroke="#FFFFFF" strokeWidth="5.3" />
      <path d="M12 0 V16 M0 8 H24" stroke="#C8102E" strokeWidth="3.2" />
    </>
  ),
  de: (
    <>
      <rect width="24" height="16" fill="#FFCE00" />
      <rect width="24" height="10.667" fill="#DD0000" />
      <rect width="24" height="5.333" fill="#000000" />
    </>
  ),
  fr: (
    <>
      <rect width="24" height="16" fill="#FFFFFF" />
      <rect width="8" height="16" fill="#002654" />
      <rect x="16" width="8" height="16" fill="#CE1126" />
    </>
  ),
  es: (
    <>
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </>
  ),
  it: (
    <>
      <rect width="24" height="16" fill="#FFFFFF" />
      <rect width="8" height="16" fill="#008C45" />
      <rect x="16" width="8" height="16" fill="#CD212A" />
    </>
  ),
};

interface LocaleFlagProps {
  locale: Locale;
  className?: string;
}

/** Small square flag chip for `locale`, decorative by design (the language name labels it). */
export function LocaleFlag({ locale, className }: LocaleFlagProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex h-3.5 w-5 shrink-0 overflow-hidden ring-1 ring-[var(--border-color)]', className)}
    >
      <svg viewBox="0 0 24 16" className="h-full w-full" preserveAspectRatio="none">
        {FLAGS[locale]}
      </svg>
    </span>
  );
}
