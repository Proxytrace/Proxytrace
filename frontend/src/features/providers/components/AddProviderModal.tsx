import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { ModelProviderKind } from '../../../api/models';
import { Modal, ModalFooter } from '../../../components/overlays/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { PROVIDER_KIND_OPTIONS } from '../providerMeta';
import { useCreateProvider } from '../hooks/useProviderMutations';

const FIELDS: { label: MessageDescriptor; key: 'name' | 'endpoint' | 'upstreamApiKey'; placeholder: string; type: string; mono: boolean }[] = [
  { label: msg`Provider name`, key: 'name', placeholder: 'e.g. OpenAI', type: 'text', mono: false },
  { label: msg`Endpoint URL`, key: 'endpoint', placeholder: 'https://api.openai.com/v1', type: 'text', mono: true },
  { label: msg`Upstream API key`, key: 'upstreamApiKey', placeholder: 'sk-…', type: 'password', mono: true },
];

interface AddProviderModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function AddProviderModal({ onClose, onCreated }: AddProviderModalProps) {
  const { t, i18n } = useLingui();
  const [form, setForm] = useState({ name: '', endpoint: '', upstreamApiKey: '', kind: ModelProviderKind.OpenAi });
  const createProvider = useCreateProvider();

  return (
    <Modal
      title={t`Add provider`}
      onClose={onClose}
      maxWidth={460}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={() => createProvider.mutate(form, { onSuccess: p => onCreated(p.id) })}
          submitLabel={createProvider.isPending ? t`Saving…` : t`Add provider`}
          loading={createProvider.isPending}
          disabled={!form.name || !form.endpoint || !form.upstreamApiKey}
        />
      }
    >
      <div className="flex flex-col gap-3.5">
        {FIELDS.map(f => (
          <FormField key={f.key} label={i18n._(f.label)}>
            <Input
              data-testid={`provider-field-${f.key}`}
              type={f.type}
              value={form[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className={f.mono ? 'font-mono' : undefined}
            />
          </FormField>
        ))}
        <FormField label={t`Provider kind`}>
          <Select data-testid="provider-field-kind" value={form.kind} onValueChange={v => setForm(p => ({ ...p, kind: v as ModelProviderKind }))}>
            {PROVIDER_KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FormField>
      </div>
    </Modal>
  );
}
