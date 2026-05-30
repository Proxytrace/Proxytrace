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
      <div className="flex flex-col gap-3.5">
        {suitePassRates.map(s => {
          const pct = s.testCases > 0 ? (s.passed / s.testCases) * 100 : 0;
          const clr = color(pct);
          return (
            <div key={s.suiteId} className="flex flex-col gap-1.5" data-testid={`suite-pass-rate-${s.suiteId}`}>
              <div className="flex items-baseline justify-between gap-2 text-body-sm">
                <span className="font-medium text-primary truncate">{s.suiteName}</span>
                <span className="shrink-0 flex items-baseline gap-1.5 font-mono">
                  <span className="text-muted">{s.passed}/{s.testCases}</span>
                  <span className="font-semibold" style={{ color: clr }}>{Math.round(pct)}%</span>
                </span>
              </div>
              <div className="h-[6px] rounded-full bg-card-2 overflow-hidden">
                <div className="h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: clr }} />
              </div>
              <span className="text-caption text-muted">{fmtRelative(s.latestRunAt)}</span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
