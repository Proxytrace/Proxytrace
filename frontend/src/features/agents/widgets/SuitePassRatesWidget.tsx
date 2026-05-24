import type { AgentSuitePassRateDto } from '../../../api/models';
import { fmtRelative } from '../../../lib/format';
import { Widget } from './Widget';

interface Props {
  suitePassRates: AgentSuitePassRateDto[];
  className?: string;
}

function color(pct: number): string {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 50) return 'var(--accent-primary)';
  return 'var(--warn)';
}

export function SuitePassRatesWidget({ suitePassRates, className }: Props) {
  if (suitePassRates.length === 0) {
    return (
      <Widget title="Suite Pass Rates" className={className}>
        <div className="text-body text-muted italic">No suite runs yet</div>
      </Widget>
    );
  }

  return (
    <Widget
      title="Suite Pass Rates"
      right={<span className="text-body-sm text-muted">{suitePassRates.length} suite{suitePassRates.length !== 1 ? 's' : ''}</span>}
      className={className}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {suitePassRates.map(s => {
          const pct = s.testCases > 0 ? (s.passed / s.testCases) * 100 : 0;
          return (
            <div key={s.suiteId} className="flex flex-col gap-1 bg-card-2 rounded-md p-3 shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between gap-2 text-body-sm">
                <span className="font-medium text-primary truncate">{s.suiteName}</span>
                <span className="font-mono text-muted shrink-0">
                  {s.passed}/{s.testCases} · {Math.round(pct)}%
                </span>
              </div>
              <div className="h-[5px] rounded-full bg-card overflow-hidden">
                <div className="h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color(pct) }} />
              </div>
              <span className="text-caption text-muted">{fmtRelative(s.latestRunAt)}</span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
