// Token usage by agent — donut share + ranked legend.

import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { Donut, type DonutSegment } from '../../../components/charts';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RowButton } from '../../../components/ui/RowButton';
import { agentColor } from '../../../lib/colors';
import { fmtTokens } from '../../../lib/format';
import type { RangeKey } from '../../../lib/time-range';
import type { TokenAgentShare } from '../dashboardMeta';

const ROW_CLS =
  'group w-full flex items-center gap-3.5 min-w-0 rounded-md px-2 py-1 -mx-2 cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]';

interface TokenByAgentSectionProps {
  share: TokenAgentShare;
  range: RangeKey;
}

const MAX_LEGEND = 7;

export function TokenByAgentSection({ share, range }: TokenByAgentSectionProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const visible = share.agents.slice(0, MAX_LEGEND);
  const rest = share.agents.slice(MAX_LEGEND);
  const restTokens = rest.reduce((n, a) => n + a.tokens, 0);

  const segments: DonutSegment[] = visible.map(a => ({ label: a.name, value: a.tokens, color: agentColor(a.id) }));
  if (restTokens > 0) segments.push({ label: t`Other`, value: restTokens, color: 'var(--text-muted)' });

  return (
    <section data-testid="token-by-agent" className="rounded-lg bg-card flex flex-col shadow-[var(--shadow-card)]">
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-1.5">
        <h3 className="text-h2 font-semibold whitespace-nowrap"><Trans>Token usage by agent</Trans></h3>
        <p className="text-body-sm text-muted font-mono">
          <Trans>{range} · <span className="text-secondary font-semibold">{fmtTokens(share.total)}</span> total</Trans>
        </p>
      </header>

      <div className="flex-1 px-4 pb-4 pt-1 flex items-center">
        {share.total === 0 ? (
          <div className="w-full h-[160px] flex items-center justify-center">
            <EmptyState title={t`No agent token data`} description={t`Per-agent token usage appears once your agents handle traffic.`} />
          </div>
        ) : (
          <div className="w-full flex items-center gap-9">
            <Donut segments={segments} size={172} thickness={24}>
              <span className="text-[26px] font-extrabold tracking-[-0.03em] leading-none text-primary tabular-nums">
                {fmtTokens(share.total)}
              </span>
              <span className="text-[10px] text-muted tracking-[0.16em] uppercase font-mono mt-1"><Trans>tokens</Trans></span>
            </Donut>

            <ul className="flex-1 min-w-0 flex flex-col gap-2.5">
              {visible.map(a => (
                <li key={a.id} className="flex">
                  <RowButton
                    data-testid={`token-by-agent-row-${a.id}`}
                    onClick={() => navigate(`/agents?id=${a.id}`)}
                    className={ROW_CLS}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: agentColor(a.id) }} />
                    <span className="text-body text-secondary group-hover:text-primary transition-colors truncate w-[34%] max-w-[220px] shrink-0 text-left">{a.name}</span>
                    <span className="flex-1 h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden min-w-[40px]">
                      <span className="block h-full rounded-full" style={{ width: `${a.share * 100}%`, background: agentColor(a.id) }} />
                    </span>
                    <span className="mono text-body text-primary tabular-nums shrink-0 w-16 text-right">{fmtTokens(a.tokens)}</span>
                    <span className="mono text-body text-muted tabular-nums shrink-0 w-10 text-right">{Math.round(a.share * 100)}%</span>
                  </RowButton>
                </li>
              ))}
              {rest.length > 0 && (
                <li className="flex">
                  <RowButton onClick={() => navigate('/agents')} className={`${ROW_CLS} text-muted font-mono`}>
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-[var(--text-muted)]" />
                    <span className="text-body w-[34%] max-w-[220px] shrink-0 text-left group-hover:text-secondary transition-colors"><Trans>+{rest.length} more</Trans></span>
                    <span className="flex-1 h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden min-w-[40px]">
                      <span className="block h-full rounded-full bg-[var(--text-muted)]" style={{ width: `${(restTokens / share.total) * 100}%` }} />
                    </span>
                    <span className="text-body tabular-nums shrink-0 w-16 text-right">{fmtTokens(restTokens)}</span>
                    <span className="text-body tabular-nums shrink-0 w-10 text-right">{Math.round((restTokens / share.total) * 100)}%</span>
                  </RowButton>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
