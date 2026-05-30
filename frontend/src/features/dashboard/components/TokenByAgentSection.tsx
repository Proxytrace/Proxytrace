// Token usage by agent — stacked bar chart section.

import { StackedBar } from '../../../components/charts';
import { EmptyState } from '../../../components/ui/EmptyState';
import { agentColor } from '../../../lib/colors';
import { fmtTokens } from '../../../lib/format';
import type { RangeKey } from '../../../lib/time-range';
import type { TokenByAgent } from '../dashboardMeta';

interface TokenByAgentSectionProps {
  tokenByAgent: TokenByAgent;
  agentNameById: Map<string, string>;
  range: RangeKey;
}

export function TokenByAgentSection({ tokenByAgent, agentNameById, range }: TokenByAgentSectionProps) {
  return (
    <section data-testid="token-by-agent" className="rounded-lg bg-card flex flex-col shadow-[var(--shadow-card)]">
      <header className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1.5">
        <div className="min-w-0">
          <h3 className="text-h2 font-semibold whitespace-nowrap">Token usage by agent</h3>
          <p className="text-body-sm text-muted mt-0.5 font-mono">{range} · stacked</p>
        </div>
        <div className="flex gap-2.5 text-[10.5px] text-secondary flex-wrap justify-end max-w-[320px] font-mono">
          {tokenByAgent.agentIds.map(id => (
            <span key={id} data-testid={`token-by-agent-row-${id}`} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: agentColor(id) }} />
              {agentNameById.get(id) ?? id.slice(0, 6)}
            </span>
          ))}
        </div>
      </header>
      <div className="px-3 pb-3">
        {tokenByAgent.data.length > 0 ? (
          <StackedBar data={tokenByAgent.data} height={160} formatValue={v => `${fmtTokens(v)} tokens`} />
        ) : (
          <div className="h-[160px] flex items-center justify-center">
            <EmptyState
              title="No agent token data"
              description="Per-agent token usage appears once the backend stat is implemented."
            />
          </div>
        )}
      </div>
    </section>
  );
}
