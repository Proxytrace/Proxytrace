import { Trans } from '@lingui/react/macro';
import { fmtTokens } from '../../../../lib/format';
import type { EndpointUsageDto } from '../../../../api/models';

export function CostPanel({ endpoints }: { endpoints: EndpointUsageDto[] }) {
  const totalCost = endpoints.reduce((s, ep) => s + ep.costUsd, 0);
  const totalTok = endpoints.reduce((s, ep) => s + ep.tokIn + ep.tokOut, 0);
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2.5">
        <div className="text-title font-semibold text-secondary"><Trans>Cost</Trans></div>
        <div className="mono text-h2 font-bold text-primary">${totalCost.toFixed(4)}</div>
        <div className="text-body-sm text-muted"><Trans>{fmtTokens(totalTok)} tok</Trans></div>
      </div>
      {totalCost > 0 && (
        <div className="flex h-1 rounded-full overflow-hidden mb-2.5">
          {endpoints.map(ep => (
            <div
              key={ep.id}
              style={{ width: `${(ep.costUsd / totalCost * 100).toFixed(1)}%`, background: ep.color }}
              title={ep.label}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {endpoints.map(ep => (
          <div key={ep.id} className="grid grid-cols-[1fr_auto_auto_auto] px-3 py-2 rounded-lg items-center gap-3 bg-black/[0.14]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ep.color }} />
              <span className="text-body font-semibold truncate">{ep.label}</span>
              {ep.region && (
                <span className="text-caption text-muted px-[5px] py-px bg-card-2 rounded-sm shrink-0">{ep.region}</span>
              )}
            </div>
            <span className="mono text-body-sm text-muted text-right whitespace-nowrap">
              {fmtTokens(ep.tokIn)}→{fmtTokens(ep.tokOut)}
            </span>
            <span className="mono text-body-sm text-secondary text-right">{ep.calls}×</span>
            <span className="mono text-body font-semibold text-primary text-right">${ep.costUsd.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
