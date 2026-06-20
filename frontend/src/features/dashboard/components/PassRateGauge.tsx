// Evaluation pass-rate gauge section.

import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import { SegmentedGauge } from '../../../components/charts';
import type { SummaryDto } from '../../../api/models';
import { cn } from '../../../lib/cn';

interface PassRateGaugeProps {
  summary: SummaryDto | undefined;
}

const GAUGE_STATS: { l: MessageDescriptor; c: string }[] = [
  { l: msg`last run`, c: cn('text-success') },
  { l: msg`best`, c: cn('text-primary') },
  { l: msg`target`, c: cn('text-muted') },
];

export function PassRateGauge({ summary }: PassRateGaugeProps) {
  const { i18n, t } = useLingui();
  const passPct = Math.round((summary?.overallPassRate ?? 0) * 100);

  const statValues = [
    t`+7pt`,
    `${Math.max(passPct, 85)}%`,
    '90%',
  ];

  return (
    <section data-testid="pass-rate-gauge" className="relative overflow-hidden rounded-lg bg-card px-3.5 pt-2.5 pb-3 flex flex-col gap-1 shadow-[var(--shadow-card)]">
      <div className="absolute top-5 -right-8 w-[220px] h-[220px] pointer-events-none bg-[radial-gradient(circle,color-mix(in_srgb,var(--success)_6%,transparent),transparent_65%)]" />
      <header>
        <h3 className="text-h2 font-semibold"><Trans>Evaluation pass rate</Trans></h3>
        <p className="text-body-sm text-muted mt-[3px] font-mono"><Trans>latest suite run · project-wide</Trans></p>
      </header>
      <div className="flex justify-center">
        <SegmentedGauge value={passPct} size={180} label={i18n._(msg`PASS RATE`)} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-auto relative">
        {GAUGE_STATS.map((s, idx) => (
          <div key={idx} className="px-3 py-2.5 bg-card-2 rounded-md shadow-[var(--shadow-pill)]">
            <div className="text-[9px] text-muted tracking-[0.12em] uppercase font-bold font-mono">{i18n._(s.l)}</div>
            <div className={cn('text-[16px] font-bold mt-[3px] tabular-nums', s.c)}>
              {statValues[idx]}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
