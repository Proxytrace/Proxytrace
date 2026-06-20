import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ApiKeyDto, ProjectDto } from '../../../api/models';
import { Button, IconButton } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { DataTable, type DataColumn } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { CopyIcon, PlusIcon, TrashIcon, XIcon } from '../../../components/icons';
import { fmtDate } from '../../../lib/format';
import { ingestionUrl } from '../../../lib/ingestion';
import { useIngestionBase } from '../../../hooks/useIngestionBase';
import useToast from '../../../hooks/useToast';
import { cn } from '../../../lib/cn';
import { maskKey } from '../providerMeta';
import { useCreateKey, useDeleteKey } from '../hooks/useProviderMutations';

interface KeysSectionProps {
  providerId: string;
  keys: ApiKeyDto[];
  projects: ProjectDto[];
  defaultProjectId: string;
}

export function KeysSection({ providerId, keys, projects, defaultProjectId }: KeysSectionProps) {
  const { t } = useLingui();
  const { show: toast } = useToast();
  const proxyBase = useIngestionBase();
  const [showNew, setShowNew] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', projectId: '' });
  const [toDelete, setToDelete] = useState<ApiKeyDto | null>(null);
  const [created, setCreated] = useState<ApiKeyDto | null>(null);

  const createKey = useCreateKey(providerId);
  const deleteKey = useDeleteKey(providerId);

  const columns: DataColumn<ApiKeyDto>[] = [
    { key: 'name', label: t`Name`, width: '1.5fr', render: k => <span data-testid={`key-row-${k.id}`} className="text-title font-semibold text-primary">{k.name}</span> },
    { key: 'project', label: t`Project`, width: '1.2fr', render: k => <span className="text-body text-secondary">{k.projectName}</span> },
    {
      key: 'key', label: t`Key`, width: '1.6fr',
      render: k => (
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="font-mono text-body text-muted overflow-hidden text-ellipsis whitespace-nowrap flex-1">{maskKey(k.keyValue)}</code>
          {/* eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy */}
          <IconButton aria-label={t`Copy key`} onClick={() => { navigator.clipboard.writeText(k.keyValue); toast(t`API key copied`, 'success'); }}>
            <CopyIcon size={13} />
          </IconButton>
        </div>
      ),
    },
    {
      key: 'ingestionUrl', label: t`Ingestion URL`, width: '2.2fr',
      render: k => {
        const url = ingestionUrl(k.projectName, proxyBase);
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <code className="font-mono text-body text-secondary overflow-hidden text-ellipsis whitespace-nowrap flex-1">{url}</code>
            {/* eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy */}
            <IconButton aria-label={t`Copy ingestion URL`} onClick={() => { navigator.clipboard.writeText(url); toast(t`Ingestion URL copied`, 'success'); }}>
              <CopyIcon size={13} />
            </IconButton>
          </div>
        );
      },
    },
    { key: 'created', label: t`Created`, width: '1fr', render: k => <span className="text-body text-muted">{fmtDate(k.createdAt)}</span> },
    { key: 'delete', label: '', width: cn('auto'), render: k => <IconButton data-testid={`key-delete-btn-${k.id}`} aria-label={t`Delete key`} danger onClick={() => setToDelete(k)}><TrashIcon size={13} /></IconButton> },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-h2 font-semibold text-primary mb-0.5"><Trans>Proxytrace API keys</Trans></div>
          <div className="text-body-sm text-muted"><Trans>Keys that authenticate clients at the Proxytrace proxy.</Trans></div>
        </div>
        <Button
          data-testid="key-create-btn"
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon size={13} />}
          onClick={() => { setShowNew(true); setNewKey({ name: '', projectId: defaultProjectId }); }}
        >
          <Trans>Generate key</Trans>
        </Button>
      </div>

      {created && (
        <div className="px-4 py-3 rounded-lg flex items-center gap-3 bg-success-subtle border border-[color-mix(in_srgb,var(--success)_28%,transparent)]">
          <div className="flex-1 min-w-0">
            <div className="text-body font-semibold mb-1 text-success"><Trans>Key "{created.name}" created — copy it now</Trans></div>
            <code data-testid="key-value-reveal" className="font-mono text-body text-primary break-all">{created.keyValue}</code>
            <div className="flex items-baseline gap-1.5 mt-2 min-w-0">
              <span className="text-body-sm text-muted whitespace-nowrap"><Trans>Ingestion URL</Trans></span>
              <code className="font-mono text-body-sm text-secondary break-all">{ingestionUrl(created.projectName, proxyBase)}</code>
            </div>
          </div>
          {/* eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy */}
          <Button variant="success" size="sm" leftIcon={<CopyIcon size={12} />} onClick={() => { navigator.clipboard.writeText(created.keyValue); toast(t`API key copied`, 'success'); }}><Trans>Copy</Trans></Button>
          <IconButton aria-label={t`Dismiss`} onClick={() => setCreated(null)}><XIcon size={14} /></IconButton>
        </div>
      )}

      {showNew && (
        <div className="p-4 bg-card-2 rounded-lg border border-hairline flex flex-col gap-3">
          <div className="text-title font-semibold text-primary"><Trans>Generate new key</Trans></div>
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label={t`Key name`}>
              <Input data-testid="key-name-input" value={newKey.name} onChange={e => setNewKey(k => ({ ...k, name: e.target.value }))} placeholder={t`e.g. production-agent`} />
            </FormField>
            <FormField label={t`Project`}>
              <Select value={newKey.projectId} onValueChange={v => setNewKey(k => ({ ...k, projectId: v }))}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}><Trans>Cancel</Trans></Button>
            <Button
              data-testid="key-create-submit"
              data-write variant="primary" size="sm"
              loading={createKey.isPending}
              disabled={!newKey.name || !newKey.projectId}
              onClick={() => createKey.mutate(newKey, { onSuccess: k => { setShowNew(false); setCreated(k); } })}
            >
              <Trans>Generate</Trans>
            </Button>
          </div>
        </div>
      )}

      {keys.length === 0 && !showNew && (
        <EmptyState title={t`No API keys yet`} description={t`Generate one to start proxying requests.`} />
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
