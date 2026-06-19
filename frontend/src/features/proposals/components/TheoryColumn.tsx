import { useLingui } from '@lingui/react/macro';
import { CheckIcon, FlaskIcon, SparklesIcon, XIcon } from '../../../components/icons';
import { TheoryStatus } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { type ColumnMeta } from '../theoryBoard';
import type { DisplayTone } from '../shared';
import { TONE_SUBTLE_BG, TONE_TEXT } from '../shared';

interface Props {
  column: ColumnMeta;
  count: number;
  children: React.ReactNode;
}

const COLUMN_ICON: Record<TheoryStatus, React.ReactNode> = {
  [TheoryStatus.Proposed]: <SparklesIcon size={13} />,
  [TheoryStatus.Validating]: <FlaskIcon size={13} />,
  [TheoryStatus.Validated]: <CheckIcon size={13} />,
  [TheoryStatus.Invalidated]: <XIcon size={13} />,
};

// Tone → top-border accent class. Mirrors the CSS vars behind {@link TONE_BG}.
const TONE_TOP_BORDER: Record<DisplayTone, string> = {
  accent: 'border-t-[var(--accent-primary)]',
  success: 'border-t-[var(--success)]',
  danger: 'border-t-[var(--danger)]',
  teal: 'border-t-[var(--teal)]',
  muted: 'border-t-[var(--text-muted)]',
  secondary: 'border-t-[var(--text-secondary)]',
};

export function TheoryColumn({ column, count, children }: Props) {
  const { i18n } = useLingui();
  return (
    <section className="flex flex-col xl:min-h-0" data-testid={`theory-column-${column.status}`}>
      {/* Header */}
      <div className={cn('rounded-lg border border-border border-t-2 bg-card-2 px-3.5 py-3 shrink-0', TONE_TOP_BORDER[column.tone])}>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex size-6 items-center justify-center rounded-md', TONE_SUBTLE_BG[column.tone], TONE_TEXT[column.tone])}>
            {COLUMN_ICON[column.status]}
          </span>
          <h2 className="text-h2 font-semibold text-primary m-0">{i18n._(column.label)}</h2>
          <span
            className={cn('mono ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-body-sm font-semibold', TONE_SUBTLE_BG[column.tone], TONE_TEXT[column.tone])}
            data-testid={`theory-column-count-${column.status}`}
          >
            {count}
          </span>
        </div>
        <p className="text-caption text-muted mt-1 ml-8">{i18n._(column.sublabel)}</p>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5 mt-2.5 pr-1 pb-4 xl:flex-1 xl:min-h-0 xl:overflow-y-auto" data-testid={`theory-column-list-${column.status}`}>
        {children}
      </div>
    </section>
  );
}
