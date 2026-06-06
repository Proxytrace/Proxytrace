import { Svg, type IconProps } from './Svg';

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="9 18 15 12 9 6"/>
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="6 9 12 15 18 9"/>
    </Svg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="18 15 12 9 6 15"/>
    </Svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
    </Svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
    </Svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
    </Svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
    </Svg>
  );
}

export function ArrowDownToLineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 17V3"/>
      <path d="m6 11 6 6 6-6"/>
      <path d="M19 21H5"/>
    </Svg>
  );
}

export function ArrowUpFromLineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21V7"/>
      <path d="m6 13 6-6 6 6"/>
      <path d="M19 3H5"/>
    </Svg>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 3h6v6"/><path d="M9 21H3v-6"/>
      <path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
    </Svg>
  );
}

/** Tiny 8×8 chevron for inline badges (e.g. an expand/collapse affordance).
 *  Distinct from ChevronRightIcon (24×24); takes an inline `style` for rotation. */
export function MiniChevronIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={className} style={style}>
      <path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
