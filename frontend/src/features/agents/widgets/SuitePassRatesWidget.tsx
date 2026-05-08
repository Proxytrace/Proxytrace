import type { AgentSuitePassRateDto } from '../../../api/models';
import { fmtRelative } from '../../../lib/format';
import { Widget } from './Widget';

interface Props {
  suitePassRates: AgentSuitePassRateDto[];
  className?: string;
}

function color(pct: number): string {
  if (pct >= 80) return '#3daa6f';
  if (pct >= 50) return '#c9944a';
  return '#d4915c';
}

export function SuitePassRatesWidget({ suitePassRates, className }: Props) {
  if (suitePassRates.length === 0) {
    return (
      <Widget title="Suite Pass Rates" className={className}>
        <div className="text-[12px] text-muted italic">No suite runs yet</div>
      </Widget>
    );
  }

  return (
    <Widget
      title="Suite Pass Rates"
      right={<span className="text-[10.5px] text-muted">{suitePassRates.length} suite{suitePassRates.length !== 1 ? 's' : ''}</span>}
      className={className}
    >
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {suitePassRates.map(s => {
          const pct = s.testCases > 0 ? (s.passed / s.testCases) * 100 : 0;
          return (
            <div key={s.suiteId} className="flex flex-col gap-[4px] bg-card-2 rounded-xl p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                <span className="font-medium truncate">{s.suiteName}</span>
                <span className="font-mono text-muted shrink-0">
                  {s.passed}/{s.testCases} · {Math.round(pct)}%
                </span>
              </div>
              <div className="h-[5px] rounded-full bg-card overflow-hidden">
                <div className="h-full" style={{ width: `${pct}%`, background: color(pct) }} />
              </div>
              <span className="text-[10px] text-muted">{fmtRelative(s.latestRunAt)}</span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
