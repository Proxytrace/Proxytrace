import { useMemo } from 'react';
import { Plural, Trans } from '@lingui/react/macro';
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
 * Derived from the same timeline rows, so it needs no extra query. Hidden when nothing is flagged.
 * Clicking a row filters the whole page to that agent. */
export function NeedsHelpStrip({ rows, agentName, onSelectAgent }: Props) {
  const ranked = useMemo(() => rankAgents(rows), [rows]);
  if (ranked.length === 0) return null;

  return (
    <div className="bg-card rounded-lg shadow-[var(--shadow-card)] p-4" data-testid="anomaly-needs-help">
      <h2 className="text-h2 font-semibold text-primary mb-3"><Trans>Needs help most</Trans></h2>
      <div className="flex flex-col gap-0.5" data-testid="anomaly-needs-help-list">
        {ranked.map(r => (
          <RowButton
            key={r.agentId}
            data-testid={`anomaly-needs-help-row-${r.agentId}`}
            onClick={() => onSelectAgent(r.agentId)}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 transition-colors duration-100 hover:bg-[var(--bg-wash-hover)]"
          >
            <ColoredBadge color={agentColor(r.agentId)} label={agentName(r.agentId)} dot />
            <span className="ml-auto shrink-0 mono text-body-sm font-semibold text-primary">{r.total}</span>
            <span className="shrink-0 text-caption text-muted w-16 text-right">
              <Plural value={r.total} one="anomaly" other="anomalies" />
            </span>
          </RowButton>
        ))}
      </div>
    </div>
  );
}
