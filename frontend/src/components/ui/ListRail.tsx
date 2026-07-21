import React from 'react';
import { useLingui } from '@lingui/react/macro';
import { cn } from '../../lib/cn';
import { EYEBROW_CLS } from './classes';
import { Button, IconButton } from './Button';
import { Input } from './Input';
import { SkeletonList } from './Skeleton';
import { EmptyState } from './EmptyState';
import { PlusIcon, SearchLineIcon, XIcon } from '../icons';

/**
 * Locked grid template for every master-detail split that hosts a `ListRail`.
 * One width token across Agents / Evaluators / Suites / Runs so the left column is
 * identical everywhere (DESIGN.md "List rail").
 */
// eslint-disable-next-line lingui/no-unlocalized-strings -- Tailwind class string, not UI copy
export const LIST_RAIL_COLS = 'grid-cols-[minmax(248px,320px)_minmax(0,1fr)]';

/** Shared shell card classes — the framed panel of every rail. */
// eslint-disable-next-line lingui/no-unlocalized-strings -- Tailwind class string, not UI copy
export const RAIL_CARD_CLS = 'flex flex-col min-h-0 overflow-hidden bg-card rounded-lg shadow-[var(--shadow-card)]';

interface CreateSlot { onClick: () => void; label?: string; testId?: string }
interface SearchSlot { value: string; onChange: (v: string) => void; placeholder?: string }

interface RailHeaderProps {
  /** Row A — sentence-case panel title. Always shown. */
  title: string;
  /** Row A — right-aligned count badge. Omit to hide. */
  count?: number;
  /** Row A — secondary line under the title (e.g. the playground's hint). */
  subtitle?: string;
  /** Row A — leading brand mark (icon badge), left of the title. Reserved for documented exceptions. */
  leading?: React.ReactNode;
  /** Row B — primary create action. Omit to collapse the row. */
  create?: CreateSlot;
  /** Row C — controlled search. Omit to collapse the row. */
  search?: SearchSlot;
}

/**
 * The locked header zone of a rail: title + count (Row A), an optional primary create
 * action (Row B), an optional search box (Row C). Shared by `ListRail` and by the
 * playground's two-picker rail so the title line is pixel-identical everywhere.
 */
export function RailHeader({ title, count, subtitle, leading, create, search }: RailHeaderProps) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-2.25 px-3.5 pt-3.5 pb-2.5 border-b border-hairline shrink-0">
      <div className="flex items-center gap-2.5">
        {leading}
        <div className="min-w-0 flex-1">
          <div className="text-h2 font-semibold tracking-[-0.01em] truncate">{title}</div>
          {subtitle && <div className="text-body-sm text-muted truncate">{subtitle}</div>}
        </div>
        {count !== undefined && <span className={cn(EYEBROW_CLS, 'shrink-0')}>{count}</span>}
      </div>

      {create && (
        <Button
          variant="primary"
          size="sm"
          fullWidth
          data-testid={create.testId}
          leftIcon={<PlusIcon size={12} />}
          onClick={create.onClick}
        >
          {create.label ?? t`New`}
        </Button>
      )}

      {search && (
        <Input
          leftAddon={<SearchLineIcon size={12} />}
          // eslint-disable-next-line lingui/no-unlocalized-strings -- size variant token, not UI copy
          inputSize="sm"
          rightAddon={search.value ? (
            <IconButton size="sm" onClick={() => search.onChange('')} aria-label={t`Clear search`}>
              <XIcon size={12} />
            </IconButton>
          ) : undefined}
          value={search.value}
          onChange={e => search.onChange(e.target.value)}
          placeholder={search.placeholder ?? t`Search…`}
        />
      )}
    </div>
  );
}

interface ListRailProps extends RailHeaderProps {
  /** Filter band — a single locked slot (height/placement fixed); pass any control. */
  filter?: React.ReactNode;
  /** List body — the rows (the view owns their inner flex/gap layout). */
  children: React.ReactNode;
  loading?: boolean;
  /** True when there are no rows — renders `empty` (or a default) instead of children. */
  isEmpty?: boolean;
  /** Custom empty node; falls back to a generic `EmptyState`. */
  empty?: React.ReactNode;
  skeletonRows?: number;
  skeletonHeight?: number;
  /** `data-testid` on the scrolling body. */
  listTestId?: string;
  /** `data-testid` on the rail `<aside>`. */
  railTestId?: string;
  className?: string;
}

/**
 * The canonical left column of a master-detail view: a framed card with the locked
 * `RailHeader`, an optional filter band, then a scrolling body of rows. Omitted header
 * slots collapse so views with fewer controls (Agents has no create, Runs has neither
 * create nor search) still read as the same panel. Pure presentation: no data, no Query,
 * no selection logic — the page owns those and passes rows as `children`.
 */
export function ListRail({
  title,
  count,
  subtitle,
  leading,
  create,
  search,
  filter,
  children,
  loading = false,
  isEmpty = false,
  empty,
  skeletonRows = 6,
  skeletonHeight = 64,
  listTestId,
  railTestId,
  className,
}: ListRailProps) {
  const { t } = useLingui();
  return (
    <aside data-testid={railTestId} className={cn(RAIL_CARD_CLS, className)}>
      <RailHeader title={title} count={count} subtitle={subtitle} leading={leading} create={create} search={search} />

      {filter && <div className="px-2.5 py-2 border-b border-hairline shrink-0">{filter}</div>}

      <div data-testid={listTestId} className="flex-1 min-h-0 overflow-y-auto px-2 py-2.5">
        {loading
          ? <SkeletonList rows={skeletonRows} height={skeletonHeight} gap={6} />
          : isEmpty
            ? (empty ?? <EmptyState title={t`Nothing here yet`} />)
            : children}
      </div>
    </aside>
  );
}
