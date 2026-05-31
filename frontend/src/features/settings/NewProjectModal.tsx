import { useState } from 'react';
import { Modal, ModalFooter } from '../../components/overlays/Modal';
import { FormField } from '../../components/ui/FormField';
import type { ModelEndpointDto } from '../../api/models';
import { formInputCls } from '../../components/ui/classes';

interface NewProjectModalProps {
  endpoints: ModelEndpointDto[];
  onCancel: () => void;
  onSubmit: (req: { name: string; systemEndpointId: string }) => void;
  loading?: boolean;
}

export function NewProjectModal({ endpoints, onCancel, onSubmit, loading }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [systemEndpointId, setSystemEndpointId] = useState(endpoints[0]?.id ?? '');

  const valid = name.trim().length > 0 && systemEndpointId.length > 0;

  return (
    <Modal
      title="New project"
      onClose={onCancel}
      footer={
        <ModalFooter
          onCancel={onCancel}
          onSubmit={() => onSubmit({ name: name.trim(), systemEndpointId })}
          submitLabel={loading ? 'Creating…' : 'Create project'}
          disabled={!valid}
          loading={loading}
        />
      }
    >
      <div className="flex flex-col gap-4" data-testid="new-project-modal">
        <FormField label="Name">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Production analytics"
            data-testid="project-name-input"
            className={formInputCls}
          />
        </FormField>
        <FormField label="System endpoint">
          <select
            value={systemEndpointId}
            onChange={e => setSystemEndpointId(e.target.value)}
            className={formInputCls}
          >
            {endpoints.length === 0 && <option value="">No endpoints available</option>}
            {endpoints.map(e => (
              <option key={e.id} value={e.id}>
                {e.providerName} · {e.modelName}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </Modal>
  );
}
