import { useState } from 'react';
import type { ApiKeyDto, ProjectDto } from '../../../api/models';
import { Button, IconButton } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { DataTable, type DataColumn } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FormField } from '../../../components/ui/FormField';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { CopyIcon, PlusIcon, TrashIcon, XIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/classes';
import { fmtDate } from '../../../lib/format';
import useToast from '../../../hooks/useToast';
import { maskKey } from '../providerMeta';
import { useProviderKeys } from '../hooks/useProviderQueries';
import { useCreateKey, useDeleteKey } from '../hooks/useProviderMutations';

interface KeysTabProps {
  providerId: string;
  projects: ProjectDto[];
  defaultProjectId: string;
}

export function KeysTab({ providerId, projects, defaultProjectId }: KeysTabProps) {
  const { show: toast } = useToast();
  const { data: keys = [], isLoading } = useProviderKeys(providerId);
  const [showNew, setShowNew] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', projectId: '' });
  const [toDelete, setToDelete] = useState<ApiKeyDto | null>(null);
  const [created, setCreated] = useState<ApiKeyDto | null>(null);

  const createKey = useCreateKey(providerId);
  const deleteKey = useDeleteKey(providerId);

  const columns: DataColumn<ApiKeyDto>[] = [
    { key: 'name', label: 'Name', width: '1.5fr', render: k => <span className="text-title font-semibold text-primary">{k.name}</span> },
    { key: 'project', label: 'Project', width: '1.2fr', render: k => <span className="text-body text-secondary">{k.projectName}</span> },
    {
      key: 'key', label: 'Key', width: '2fr',
      render: k => (
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="font-mono text-body text-muted overflow-hidden text-ellipsis whitespace-nowrap flex-1">{maskKey(k.keyValue)}</code>
          <IconButton aria-label="Copy key" onClick={() => { navigator.clipboard.writeText(k.keyValue); toast('API key copied', 'success'); }}>
            <CopyIcon size={13} />
          </IconButton>
        </div>
      ),
    },
    { key: 'created', label: 'Created', width: '1fr', render: k => <span className="text-body text-muted">{fmtDate(k.createdAt)}</span> },
    { key: 'delete', label: '', width: 'auto', render: k => <IconButton aria-label="Delete key" danger onClick={() => setToDelete(k)}><TrashIcon size={13} /></IconButton> },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-h2 font-semibold text-primary mb-0.5">Proxytrace API keys</div>
          <div className="text-body-sm text-muted">Keys that authenticate clients at the Proxytrace proxy.</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon size={13} />}
          onClick={() => { setShowNew(true); setNewKey({ name: '', projectId: defaultProjectId }); }}
        >
          Generate key
        </Button>
      </div>

      {created && (
        <div className="px-4 py-3 rounded-lg flex items-center gap-3 bg-success-subtle border border-[color-mix(in_srgb,var(--success)_28%,transparent)]">
          <div className="flex-1 min-w-0">
            <div className="text-body font-semibold mb-1 text-success">Key "{created.name}" created — copy it now</div>
            <code className="font-mono text-body text-primary break-all">{created.keyValue}</code>
          </div>
          <Button variant="success" size="sm" leftIcon={<CopyIcon size={12} />} onClick={() => { navigator.clipboard.writeText(created.keyValue); toast('API key copied', 'success'); }}>Copy</Button>
          <IconButton aria-label="Dismiss" onClick={() => setCreated(null)}><XIcon size={14} /></IconButton>
        </div>
      )}

      {showNew && (
        <div className="p-4 bg-card-2 rounded-lg border border-hairline flex flex-col gap-3">
          <div className="text-title font-semibold text-primary">Generate new key</div>
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="Key name">
              <input value={newKey.name} onChange={e => setNewKey(k => ({ ...k, name: e.target.value }))} placeholder="e.g. production-agent" className={formInputCls} />
            </FormField>
            <FormField label="Project">
              <select value={newKey.projectId} onChange={e => setNewKey(k => ({ ...k, projectId: e.target.value }))} className={formInputCls}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              data-write variant="primary" size="sm"
              loading={createKey.isPending}
              disabled={!newKey.name || !newKey.projectId}
              onClick={() => createKey.mutate(newKey, { onSuccess: k => { setShowNew(false); setCreated(k); } })}
            >
              Generate
            </Button>
          </div>
        </div>
      )}

      {isLoading && <SkeletonList rows={3} height={48} gap={8} />}
      {!isLoading && keys.length === 0 && !showNew && (
        <EmptyState title="No API keys yet" description="Generate one to start proxying requests." />
      )}
      {keys.length > 0 && (
        <div className="bg-card-2 rounded-lg border border-hairline overflow-hidden">
          <DataTable columns={columns} rows={keys} rowKey={k => k.id} />
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          entityName={toDelete.name}
          onConfirm={() => deleteKey.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
          onCancel={() => setToDelete(null)}
          loading={deleteKey.isPending}
        />
      )}
    </>
  );
}
