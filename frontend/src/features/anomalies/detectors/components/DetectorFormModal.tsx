import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../../../components/overlays/Modal';
import { Button } from '../../../../components/ui/Button';
import { FormField } from '../../../../components/ui/FormField';
import { Input } from '../../../../components/ui/Input';
import { Textarea } from '../../../../components/ui/Textarea';
import { Combobox } from '../../../../components/ui/Combobox';
import { MultiCombobox } from '../../../../components/ui/MultiCombobox';
import { Switch } from '../../../../components/ui/Switch';
import useModelEndpoints from '../../../../hooks/useModelEndpoints';
import { useAgents } from '../../../agents/hooks/useAgents';
import useToast from '../../../../hooks/useToast';
import type { CustomAnomalyDetectorDto, ModelEndpointDto } from '../../../../api/models';
import {
  DETECTOR_ERROR_LABEL,
  buildCreatePayload,
  buildUpdatePayload,
  formFromDetector,
  initDetectorForm,
  validateDetectorForm,
  type DetectorFormError,
} from '../detectors';
import { useDetectorMutations } from '../hooks/useDetectorMutations';
import { TriggerEditor } from './TriggerEditor';

interface Props {
  detector: CustomAnomalyDetectorDto | null;
  onClose: () => void;
}

export function DetectorFormModal({ detector, onClose }: Props) {
  const { t, i18n } = useLingui();
  const { show: toast } = useToast();
  const { data: endpoints = [] } = useModelEndpoints();
  const { allAgents } = useAgents();
  const { create, update, projectId } = useDetectorMutations();

  const [form, setForm] = useState(() => (detector ? formFromDetector(detector) : initDetectorForm()));
  const [error, setError] = useState<DetectorFormError | null>(null);

  const isEdit = detector !== null;
  const agents = allAgents.filter(a => !a.isSystemAgent);
  // Derive the effective endpoint (default to the first) rather than syncing via an effect.
  const endpointValue = form.endpointId || endpoints[0]?.id || '';
  const saving = create.isPending || update.isPending;

  function submit() {
    const effective = { ...form, endpointId: endpointValue };
    const validation = validateDetectorForm(effective);
    if (validation) { setError(validation); return; }
    setError(null);

    const onSuccess = () => {
      // eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy
      toast(isEdit ? t`Detector updated` : t`Detector created`, 'success');
      onClose();
    };
    if (isEdit) update.mutate({ id: detector.id, request: buildUpdatePayload(effective) }, { onSuccess });
    else if (projectId) create.mutate(buildCreatePayload(projectId, effective), { onSuccess });
  }

  return (
    <Modal
      title={isEdit ? t`Edit detector` : t`New detector`}
      onClose={onClose}
      maxWidth={560}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}><Trans>Cancel</Trans></Button>
          <Button onClick={submit} loading={saving} data-testid="detector-save-btn">
            {isEdit ? <Trans>Save changes</Trans> : <Trans>Create detector</Trans>}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t`Name`}>
          <Input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={t`e.g. Refund promise watcher`}
            data-testid="detector-name-input"
          />
        </FormField>

        <FormField label={t`Review instructions`}>
          <Textarea
            value={form.instructions}
            onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
            rows={4}
            placeholder={t`Flag the turn when the assistant promises a refund without approval.`}
            data-testid="detector-instructions-input"
          />
          <p className="text-caption text-muted mt-1"><Trans>What the judge model should look for in a matched turn.</Trans></p>
        </FormField>

        <FormField label={t`Judge model`}>
          <Combobox
            value={endpointValue}
            onChange={id => setForm(f => ({ ...f, endpointId: id }))}
            items={endpoints as ModelEndpointDto[]}
            itemKey={ep => ep.id}
            itemLabel={ep => ep.modelName}
            placeholder={t`Select a model endpoint`}
            aria-label={t`Judge model endpoint`}
          />
        </FormField>

        <FormField label={t`Triggers`}>
          <TriggerEditor triggers={form.triggers} onChange={triggers => setForm(f => ({ ...f, triggers }))} />
          <p className="text-caption text-muted mt-1"><Trans>A call is reviewed only when a trigger matches — keeps LLM usage targeted.</Trans></p>
        </FormField>

        <Switch
          checked={form.allAgents}
          onChange={v => setForm(f => ({ ...f, allAgents: v }))}
          label={t`Apply to all agents`}
        />
        {!form.allAgents && (
          <FormField label={t`Agents`}>
            <MultiCombobox
              values={form.agentIds}
              onChange={agentIds => setForm(f => ({ ...f, agentIds }))}
              items={agents}
              itemKey={a => a.id}
              itemLabel={a => a.name}
              placeholder={t`Select agents`}
              aria-label={t`Scoped agents`}
            />
          </FormField>
        )}

        <Switch
          checked={form.isEnabled}
          onChange={v => setForm(f => ({ ...f, isEnabled: v }))}
          label={t`Enabled`}
        />

        {error && (
          <p className="text-body-sm text-danger" data-testid="detector-form-error">
            {i18n._(DETECTOR_ERROR_LABEL[error])}
          </p>
        )}
      </div>
    </Modal>
  );
}
