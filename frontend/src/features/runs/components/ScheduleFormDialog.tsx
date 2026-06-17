import { useState } from 'react';
import type {
  ModelEndpointDto,
  TestRunScheduleDto,
  TestSuiteListItemDto,
} from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import {
  fromIntervalMinutes,
  toIntervalMinutes,
  type IntervalUnit,
} from '../../../lib/interval';
import useModelEndpoints from '../../../hooks/useModelEndpoints';
import { useSuites } from '../../suites/hooks/useSuiteQueries';
import { Modal, ModalFooter } from '../../../components/overlays/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Switch } from '../../../components/ui/Switch';
import { RowButton } from '../../../components/ui/RowButton';

interface Props {
  /** When set, the dialog edits this schedule; otherwise it creates a new one. */
  schedule?: TestRunScheduleDto;
  onClose: () => void;
  onSubmit: (form: ScheduleFormValues) => void;
  pending: boolean;
}

export interface ScheduleFormValues {
  name: string;
  testSuiteId: string;
  modelEndpointIds: string[];
  intervalMinutes: number;
  enabled: boolean;
}

const UNIT_OPTIONS: { value: IntervalUnit; label: string }[] = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
];

export function ScheduleFormDialog({ schedule, onClose, onSubmit, pending }: Props) {
  const isEdit = schedule !== undefined;
  const { suites } = useSuites();
  const { data: endpoints = [] } = useModelEndpoints();

  const initialInterval = fromIntervalMinutes(schedule?.intervalMinutes ?? 1440);
  const [name, setName] = useState(schedule?.name ?? '');
  // On edit the suite is fixed (the backend's UpdateRequest carries no suite); only create picks one.
  const [suiteId, setSuiteId] = useState(schedule?.suiteId ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(schedule?.endpoints.map(e => e.id) ?? []),
  );
  const [value, setValue] = useState(initialInterval.value);
  const [unit, setUnit] = useState<IntervalUnit>(initialInterval.unit);
  const [enabled, setEnabled] = useState(schedule?.isEnabled ?? true);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const trimmedName = name.trim();
  const valid =
    trimmedName.length > 0 &&
    (isEdit || suiteId.length > 0) &&
    selected.size > 0 &&
    value > 0;

  function submit() {
    if (!valid) return;
    onSubmit({
      name: trimmedName,
      testSuiteId: suiteId,
      modelEndpointIds: Array.from(selected),
      intervalMinutes: toIntervalMinutes(value, unit),
      enabled,
    });
  }

  return (
    <Modal
      title={isEdit ? 'Edit schedule' : 'New schedule'}
      onClose={onClose}
      maxWidth={520}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={submit}
          submitLabel={isEdit ? 'Save schedule' : 'Create schedule'}
          loading={pending}
          disabled={!valid}
        />
      }
    >
      <div className="flex flex-col gap-4" data-testid="schedule-form">
        <FormField label="Name" htmlFor="schedule-name">
          <Input
            id="schedule-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nightly regression"
            autoFocus
            data-testid="schedule-name-input"
          />
        </FormField>

        {!isEdit && (
          <FormField label="Test suite" htmlFor="schedule-suite">
            <Select
              id="schedule-suite"
              value={suiteId}
              onValueChange={setSuiteId}
              placeholder="Select a suite"
              data-testid="schedule-suite-select"
            >
              {suites.map((s: TestSuiteListItemDto) => (
                <option key={s.id} value={s.id}>{`${s.name} · ${s.agentName}`}</option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField label="Model endpoints">
          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto" data-testid="schedule-endpoint-list">
            {endpoints.map((ep: ModelEndpointDto) => {
              const mc = modelColor(ep.modelName);
              const isOn = selected.has(ep.id);
              return (
                <RowButton
                  key={ep.id}
                  onClick={() => toggle(ep.id)}
                  aria-pressed={isOn}
                  data-testid={`schedule-endpoint-${ep.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-card-2"
                  style={isOn ? { boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${mc} 30%, transparent)` } : undefined}
                >
                  <span
                    aria-hidden
                    className="w-3.5 h-3.5 rounded-[4px] shrink-0 border"
                    style={{ borderColor: isOn ? mc : 'var(--text-muted)', background: isOn ? mc : 'transparent' }}
                  />
                  <span className="mono text-body-sm font-semibold flex-1 truncate" style={{ color: isOn ? mc : 'var(--text-secondary)' }}>
                    {ep.modelName}
                  </span>
                  <span className="text-body-sm text-muted">{ep.providerName}</span>
                </RowButton>
              );
            })}
            {endpoints.length === 0 && (
              <div className="text-center text-muted text-body py-4">No endpoints configured. Add providers first.</div>
            )}
          </div>
        </FormField>

        <FormField label="Run every">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={value}
              onChange={e => setValue(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
              className="w-24"
              data-testid="schedule-interval-value"
            />
            <div className="w-36">
              <Select value={unit} onValueChange={v => setUnit(v as IntervalUnit)} data-testid="schedule-interval-unit">
                {UNIT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>
        </FormField>

        <div className="flex items-center justify-between">
          <span className="text-title font-medium text-secondary">Enabled</span>
          <Switch
            checked={enabled}
            onChange={setEnabled}
            label="Enabled"
            data-testid="schedule-enabled-toggle"
          />
        </div>
      </div>
    </Modal>
  );
}
