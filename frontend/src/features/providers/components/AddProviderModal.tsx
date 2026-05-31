import { useState } from 'react';
import { ModelProviderKind } from '../../../api/models';
import { Modal, ModalFooter } from '../../../components/overlays/Modal';
import { FormField } from '../../../components/ui/FormField';
import { formInputCls } from '../../../components/ui/classes';
import { PROVIDER_KIND_OPTIONS } from '../providerMeta';
import { useCreateProvider } from '../hooks/useProviderMutations';

const FIELDS = [
  { label: 'Provider name', key: 'name', placeholder: 'e.g. Anthropic', type: 'text', mono: false },
  { label: 'Endpoint URL', key: 'endpoint', placeholder: 'https://api.anthropic.com/v1', type: 'text', mono: true },
  { label: 'Upstream API key', key: 'upstreamApiKey', placeholder: 'sk-ant-…', type: 'password', mono: true },
] as const;

interface AddProviderModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function AddProviderModal({ onClose, onCreated }: AddProviderModalProps) {
  const [form, setForm] = useState({ name: '', endpoint: '', upstreamApiKey: '', kind: ModelProviderKind.Anthropic });
  const createProvider = useCreateProvider();

  return (
    <Modal
      title="Add provider"
      onClose={onClose}
      maxWidth={460}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={() => createProvider.mutate(form, { onSuccess: p => onCreated(p.id) })}
          submitLabel={createProvider.isPending ? 'Saving…' : 'Add provider'}
          loading={createProvider.isPending}
          disabled={!form.name || !form.endpoint || !form.upstreamApiKey}
        />
      }
    >
      <div className="flex flex-col gap-3.5">
        {FIELDS.map(f => (
          <FormField key={f.key} label={f.label}>
            <input
              data-testid={`provider-field-${f.key}`}
              type={f.type}
              value={form[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className={`${formInputCls} ${f.mono ? 'font-mono' : ''}`}
            />
          </FormField>
        ))}
        <FormField label="Provider kind">
          <select data-testid="provider-field-kind" value={form.kind} onChange={e => setForm(p => ({ ...p, kind: e.target.value as ModelProviderKind }))} className={formInputCls}>
            {PROVIDER_KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FormField>
      </div>
    </Modal>
  );
}
