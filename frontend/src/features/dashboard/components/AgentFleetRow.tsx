// One roster row of the dashboard agent fleet — identity, an activity sparkline,
// and load stats. Clicking drills into the agent's detail view.

import { Plural, useLingui } from '@lingui/react/macro';
import { MiniArea } from '../../../components/charts';
import { Pill } from '../../../components/ui/Pill';
import { RowButton } from '../../../components/ui/RowButton';
import { agentColor } from '../../../lib/colors';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtRelative, fmtTokens } from '../../../lib/format';
import { hoverAccentWashCls } from '../../../components/ui/classes';
import type { AgentFleetEntry } from '../dashboardMeta';
import { cn } from '../../../lib/cn';

// Shared grid template — the header row and every fleet row align to these fixed tracks
// (same container-query pattern as LiveStreamRow: the section declares `@container` and
// exposes the templates as CSS vars). Two-tier collapse: below the 2xl container
// breakpoint the last-active column drops; below xl the activity sparkline goes too —
// the sparkline is the row's signature, so it outlives the timestamp.
// Columns: color bar · agent · activity · tokens · traces · last active.
// eslint-disable-next-line lingui/no-unlocalized-strings -- Tailwind grid-template class, not UI copy
export const FLEET_GRID = 'grid [grid-template-columns:var(--fleet-grid)] gap-4 @max-2xl:[grid-template-columns:var(--fleet-grid-mid)] @max-xl:[grid-template-columns:var(--fleet-grid-narrow)] @max-xl:gap-3';

export const FLEET_GRID_WIDE = '3px minmax(0,1fr) minmax(110px,1.1fr) 92px 64px 80px';
export const FLEET_GRID_MID = '3px minmax(0,1fr) minmax(110px,1.1fr) 92px 64px';
export const FLEET_GRID_NARROW = '3px minmax(0,1fr) 92px 64px';

/** Visibility class for the activity cell — drops below the xl container breakpoint. */
// eslint-disable-next-line lingui/no-unlocalized-strings -- Tailwind class, not UI copy
export const FLEET_XL_HIDDEN = '@max-xl:hidden';

/** Visibility class for the last-active cell — drops below the 2xl container breakpoint. */
// eslint-disable-next-line lingui/no-unlocalized-strings -- Tailwind class, not UI copy
export const FLEET_2XL_HIDDEN = '@max-2xl:hidden';

interface AgentFleetRowProps {
  entry: AgentFleetEntry;
  isLast: boolean;
  /** Ticked epoch-ms for the relative "last active" label. */
  now: number;
  onSelect: (id: string) => void;
}

export function AgentFleetRow({ entry, isLast, now, onSelect }: AgentFleetRowProps) {
  const { t } = useLingui();
  const c = agentColor(entry.id);
  const active = entry.tokens > 0 && entry.series.length >= 2;

  return (
    <RowButton
      data-testid={`agent-fleet-row-${entry.id}`}
      onClick={() => onSelect(entry.id)}
      className={cn(
        FLEET_GRID,
        'items-center py-2 px-1.5 transition-colors',
        hoverAccentWashCls,
        FOCUS_RING,
        !isLast && 'border-b border-border-subtle',
      )}
    >
      <span className="self-stretch my-1 rounded-none opacity-80" style={{ background: c }} />

      <span className="min-w-0 flex flex-col gap-1">
        <span data-testid={`agent-fleet-name-${entry.id}`} className="text-title font-semibold leading-tight truncate">
          {entry.name}
        </span>
        <span className="flex items-center gap-1.5 min-w-0">
          <Pill label={entry.endpointName} color={c} size="sm" />
          <span className="text-caption text-muted font-mono whitespace-nowrap">
            <Plural value={entry.toolCount} one="# tool" other="# tools" />
          </span>
        </span>
      </span>

      <span className={cn('min-w-0 self-center', FLEET_XL_HIDDEN)}>
        {active ? (
          <MiniArea data={entry.series} color={c} height={30} formatValue={v => t`${fmtTokens(v)} tokens`} />
        ) : (
          <span className="block h-px bg-border" aria-hidden="true" />
        )}
      </span>

      <span className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-body text-primary font-semibold tabular-nums">{fmtTokens(entry.tokens)}</span>
        <span className="text-caption text-muted font-mono tabular-nums">{Math.round(entry.share * 100)}%</span>
      </span>

      <span className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-body font-semibold tabular-nums" style={{ color: c }}>
          {entry.traces.toLocaleString()}
        </span>
        <span className="text-caption text-muted font-mono">{t`traces`}</span>
      </span>

      <span className={cn('text-caption text-muted font-mono tabular-nums text-right', FLEET_2XL_HIDDEN)}>
        {entry.lastUsedAt ? fmtRelative(entry.lastUsedAt, now) : '—'}
      </span>
    </RowButton>
  );
}
