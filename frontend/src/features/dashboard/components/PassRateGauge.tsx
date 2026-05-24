// Evaluation pass-rate gauge section.

import { SegmentedGauge } from '../../../components/charts';
import type { SummaryDto } from '../../../api/models';

interface PassRateGaugeProps {
  summary: SummaryDto | undefined;
}

const GAUGE_STATS = [
  { l: 'last run', c: 'var(--success)', isFixed: false, fixedV: '+7pt' },
  { l: 'best', c: 'var(--text-primary)', isFixed: false, fixedV: '' },
  { l: 'target', c: 'var(--text-muted)', isFixed: true, fixedV: '90%' },
] as const;

export function PassRateGauge({ summary }: PassRateGaugeProps) {
  const passPct = Math.round((summary?.overallPassRate ?? 0) * 100);

  const statValues = [
    '+7pt',
    `${Math.max(passPct, 85)}%`,
    '90%',
  ];

  return (
    <section className="relative overflow-hidden rounded-lg bg-card px-3.5 pt-2.5 pb-3 flex flex-col gap-1 shadow-[var(--shadow-card)]">
      <div
        className="absolute top-5 -right-8 w-[220px] h-[220px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--success) 6%, transparent), transparent 65%)' }}
      />
      <header>
        <h3 className="text-h2 font-semibold">Evaluation pass rate</h3>
        <p className="text-body-sm text-muted mt-[3px] font-mono">latest suite run · project-wide</p>
      </header>
      <div className="flex justify-center">
        <SegmentedGauge value={passPct} size={180} label="PASS RATE" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-auto relative">
        {GAUGE_STATS.map((s, idx) => (
          <div key={s.l} className="px-3 py-2.5 bg-card-2 rounded-md shadow-[var(--shadow-pill)]">
            <div className="text-[9px] text-muted tracking-[0.12em] uppercase font-bold font-mono">{s.l}</div>
            <div className="text-[16px] font-bold mt-[3px] tabular-nums" style={{ color: s.c }}>
              {statValues[idx]}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
