import { useMemo } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { RowButton } from '../../../components/ui/RowButton';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { agentColor } from '../../../lib/colors';
import type { AgentAnomalyStatDto } from '../../../api/models';
import { rankAgents } from '../anomaliesMeta';

interface Props {
  rows: AgentAnomalyStatDto[];
  agentName: (id: string) => string;
  onSelectAgent: (id: string) => void;
}

/** Ranked per-agent flagged-call totals for the window — "which agent needs help most" at a glance.
 * Derived from the same timeline rows, so it needs no extra query. Each row carries a share bar
 * (its total relative to the worst agent) so the ranking reads proportionally, not just ordinally.
 * Clicking a row filters the whole page to that agent. */
export function NeedsHelpStrip({ rows, agentName, onSelectAgent }: Props) {
  const { t } = useLingui();
  const ranked = useMemo(() => rankAgents(rows), [rows]);
  const maxTotal = ranked[0]?.total ?? 0;

  return (
    <div className="bg-card rounded-lg shadow-[var(--shadow-card)] p-4" data-testid="anomaly-needs-help">
      <h2 className="text-h2 font-semibold text-primary mb-3"><Trans>Most flagged agents</Trans></h2>

      {ranked.length === 0 && (
        <p className="text-body-sm text-muted" data-testid="anomaly-needs-help-empty">
          <Trans>No flagged agents in this window.</Trans>
        </p>
      )}

      {ranked.length > 0 && (
        <div className="flex flex-col gap-0.5" data-testid="anomaly-needs-help-list">
          {ranked.map(r => (
            <RowButton
              key={r.agentId}
              data-testid={`anomaly-needs-help-row-${r.agentId}`}
              onClick={() => onSelectAgent(r.agentId)}
              title={t`${r.total} flagged · ${r.staticTotal} statistical / ${r.customTotal} detector`}
              className="grid grid-cols-[minmax(0,auto)_minmax(24px,1fr)_auto] items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 transition-colors duration-100 hover:bg-[var(--bg-wash-hover)]"
            >
              <span className="min-w-0 overflow-hidden">
                <ColoredBadge color={agentColor(r.agentId)} label={agentName(r.agentId)} dot />
              </span>
              <span className="h-1 bg-card-2 overflow-hidden" aria-hidden>
                <span
                  className="block h-full"
                  style={{ width: `${maxTotal > 0 ? (r.total / maxTotal) * 100 : 0}%`, background: agentColor(r.agentId) }}
                />
              </span>
              <span className="shrink-0 mono text-body-sm font-semibold text-primary w-8 text-right">{r.total}</span>
            </RowButton>
          ))}
        </div>
      )}
    </div>
  );
}
