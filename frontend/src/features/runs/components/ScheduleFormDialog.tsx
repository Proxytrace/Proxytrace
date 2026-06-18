import { useState } from 'react';
import type {
  ModelEndpointDto,
  TestRunScheduleDto,
  TestSuiteListItemDto,
} from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import {
  cadenceToSchedule,
  scheduleToCadence,
  initialCadence,
  type CadenceState,
} from '../../../lib/scheduleCadence';
import useModelEndpoints from '../../../hooks/useModelEndpoints';
import { useSuites } from '../../suites/hooks/useSuiteQueries';
import { Modal, ModalFooter } from '../../../components/overlays/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Switch } from '../../../components/ui/Switch';
import { RowButton } from '../../../components/ui/RowButton';
import { ScheduleCadenceField } from './ScheduleCadenceField';

interface Props {
  /** When set, the dialog edits this schedule; otherwise it creates a new one. */
  schedule?: TestRunScheduleDto;
  /** When set (create-from-suite), the suite is fixed and shown read-only instead of a picker. */
  lockedSuite?: { id: string; name: string };
  onClose: () => void;
  onSubmit: (form: ScheduleFormValues) => void;
  pending: boolean;
}

export interface ScheduleFormValues {
  name: string;
  testSuiteId: string;
  modelEndpointIds: string[];
  intervalMinutes: number;
  /** ISO instant the recurrence is phased to (the run time). */
  anchorAt: string;
  enabled: boolean;
}

export function ScheduleFormDialog({ schedule, lockedSuite, onClose, onSubmit, pending }: Props) {
  const isEdit = schedule !== undefined;
  const { suites } = useSuites();
  const { data: endpoints = [] } = useModelEndpoints();

  const [name, setName] = useState(schedule?.name ?? '');
  // On edit the suite is fixed (the backend's UpdateRequest carries no suite); create-from-suite seeds
  // a locked suite; only the open create picker leaves it empty for the user to choose.
  const [suiteId, setSuiteId] = useState(schedule?.suiteId ?? lockedSuite?.id ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(schedule?.endpoints.map(e => e.id) ?? []),
  );
  const [cadence, setCadence] = useState<CadenceState>(() =>
    schedule ? scheduleToCadence(schedule.intervalMinutes, schedule.anchorAt) : initialCadence(),
  );
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
    (isEdit || lockedSuite !== undefined || suiteId.length > 0) &&
    selected.size > 0;

  function submit() {
    if (!valid) return;
    const { intervalMinutes, anchorAt } = cadenceToSchedule(cadence, new Date());
    onSubmit({
      name: trimmedName,
      testSuiteId: suiteId,
      modelEndpointIds: Array.from(selected),
      intervalMinutes,
      anchorAt,
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

        {lockedSuite && (
          <FormField label="Test suite">
            <div
              className="w-full px-3 py-2 bg-card-2 border border-border rounded-md text-title text-primary truncate"
              data-testid="schedule-suite-locked"
            >
              {lockedSuite.name}
            </div>
          </FormField>
        )}

        {!isEdit && !lockedSuite && (
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

        <ScheduleCadenceField cadence={cadence} onChange={setCadence} />

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
