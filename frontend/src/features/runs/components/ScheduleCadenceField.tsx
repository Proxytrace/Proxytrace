import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ClockIcon } from '../../../components/icons';
import { fmtDateTimeShortUtc, fmtUntil } from '../../../lib/format';
import { type IntervalUnit } from '../../../lib/interval';
import {
  cadenceToSchedule,
  computeNextRun,
  WEEKDAY_LABELS,
  type CadenceState,
  type Frequency,
} from '../../../lib/scheduleCadence';

const FREQUENCY_OPTIONS: { value: Frequency; label: MessageDescriptor }[] = [
  { value: 'hourly', label: msg`Hourly` },
  { value: 'daily', label: msg`Daily` },
  { value: 'weekly', label: msg`Weekly` },
  { value: 'custom', label: msg`Custom` },
];

const UNIT_OPTIONS: { value: IntervalUnit; label: MessageDescriptor }[] = [
  { value: 'minutes', label: msg`minutes` },
  { value: 'hours', label: msg`hours` },
  { value: 'days', label: msg`days` },
];

/** Frequency picker (Hourly / Daily / Weekly / Custom) with a live UTC next-run preview. Maps to the
 * backend's `(intervalMinutes, anchorAt)` via {@link cadenceToSchedule}; all times are UTC. */
export function ScheduleCadenceField({ cadence, onChange }: { cadence: CadenceState; onChange: (c: CadenceState) => void }) {
  const { t, i18n } = useLingui();
  const set = (patch: Partial<CadenceState>) => onChange({ ...cadence, ...patch });

  const now = new Date();
  const { intervalMinutes, anchorAt } = cadenceToSchedule(cadence, now);
  const next = computeNextRun(anchorAt, intervalMinutes, now);

  return (
    <FormField label={t`Frequency`}>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 flex-wrap" data-testid="schedule-cadence">
          <div className="w-32">
            <Select
              value={cadence.frequency}
              onValueChange={v => set({ frequency: v as Frequency })}
              data-testid="schedule-frequency"
            >
              {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{i18n._(o.label)}</option>)}
            </Select>
          </div>

          {cadence.frequency === 'hourly' && (
            <>
              <span className="text-body-sm text-muted"><Trans>at minute</Trans></span>
              <Input
                type="number"
                min={0}
                max={59}
                value={cadence.minute}
                onChange={e => set({ minute: Math.min(59, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
                className="w-20"
                data-testid="schedule-minute"
              />
            </>
          )}

          {cadence.frequency === 'weekly' && (
            <div className="w-36">
              <Select value={String(cadence.weekday)} onValueChange={v => set({ weekday: Number(v) })} data-testid="schedule-weekday">
                {WEEKDAY_LABELS.map((label, i) => <option key={i} value={String(i)}>{label}</option>)}
              </Select>
            </div>
          )}

          {(cadence.frequency === 'daily' || cadence.frequency === 'weekly') && (
            <>
              <span className="text-body-sm text-muted"><Trans>at</Trans></span>
              <Input
                type="time"
                value={cadence.time}
                onChange={e => set({ time: e.target.value })}
                className="w-28"
                data-testid="schedule-time"
              />
              <span className="text-body-sm text-muted"><Trans>UTC</Trans></span>
            </>
          )}

          {cadence.frequency === 'custom' && (
            <>
              <span className="text-body-sm text-muted"><Trans>every</Trans></span>
              <Input
                type="number"
                min={1}
                value={cadence.customValue}
                onChange={e => set({ customValue: Math.max(1, Math.floor(Number(e.target.value) || 0)) })}
                className="w-20"
                data-testid="schedule-interval-value"
              />
              <div className="w-32">
                <Select value={cadence.customUnit} onValueChange={v => set({ customUnit: v as IntervalUnit })} data-testid="schedule-interval-unit">
                  {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{i18n._(o.label)}</option>)}
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-body-sm text-muted" data-testid="schedule-next-run-preview">
          <ClockIcon size={12} />
          {next ? (
            <span>
              <Trans>Next run · <span className="text-secondary font-medium">{fmtDateTimeShortUtc(next.toISOString())} UTC</span>{' '}
              <span className="text-muted">({fmtUntil(next.toISOString())})</span></Trans>
            </span>
          ) : (
            <span><Trans>Next run · —</Trans></span>
          )}
        </div>
      </div>
    </FormField>
  );
}
