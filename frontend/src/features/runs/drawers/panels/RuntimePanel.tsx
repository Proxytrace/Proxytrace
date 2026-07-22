import { Trans, useLingui } from '@lingui/react/macro';
import { fmtDuration } from '../../../../lib/format';
import { tint } from '../../../../lib/colors';
import type { RuntimeBreakdownDto } from '../../../../api/models';
import { SECTION_LABEL, RUNTIME_SEGMENTS } from './constants';

export function RuntimePanel({ runtime }: { runtime: RuntimeBreakdownDto }) {
  const { i18n } = useLingui();
  const segments = RUNTIME_SEGMENTS.filter(s => (runtime[s.key] as number | null | undefined) != null && (runtime[s.key] as number) > 0);
  const total = runtime.total || segments.reduce((acc, s) => acc + ((runtime[s.key] as number) ?? 0), 0);
  return (
    <div>
      <div className={SECTION_LABEL}><Trans>Runtime</Trans></div>
      <div className="flex h-[5px] overflow-hidden mb-2.5 bg-white/[0.04]">
        {segments.map(s => (
          <div
            key={s.key}
            style={{ width: `${(((runtime[s.key] as number) ?? 0) / total * 100).toFixed(1)}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: tint(s.color, 14), border: `1px solid ${tint(s.color, 33)}` }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-body-sm text-secondary font-medium">{i18n._(s.label)}</span>
            <span className="mono text-body-sm font-semibold" style={{ color: s.color }}>
              {fmtDuration((runtime[s.key] as number) ?? 0)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-wash-hover)]">
          <span className="text-body-sm text-muted font-medium"><Trans>Total</Trans></span>
          <span className="mono text-body-sm text-primary font-semibold">{fmtDuration(total)}</span>
        </div>
      </div>
    </div>
  );
}
