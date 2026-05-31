import { useState } from 'react';
import { type ModelProviderKind, type ProviderDto } from '../../../api/models';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { CopyIcon, TrashIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/classes';
import { providerColor } from '../../../lib/colors';
import useToast from '../../../hooks/useToast';
import { PROVIDER_KIND_OPTIONS, kindColor, kindLabel, maskKey } from '../providerMeta';
import { useDeleteProvider, useUpdateProviderKind } from '../hooks/useProviderMutations';

interface ProviderDetailHeaderProps {
  provider: ProviderDto;
  onDeleted: () => void;
}

export function ProviderDetailHeader({ provider, onDeleted }: ProviderDetailHeaderProps) {
  const { show: toast } = useToast();
  const [editingKind, setEditingKind] = useState(false);
  const [editKindValue, setEditKindValue] = useState<ModelProviderKind>(provider.kind);
  const [revealKey, setRevealKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateKind = useUpdateProviderKind();
  const delProvider = useDeleteProvider();

  return (
    <div className="p-5 border-b border-hairline shrink-0" data-testid="provider-detail-header">
      <div className="flex items-start gap-3">
        <Avatar initials={provider.name[0]} color={providerColor(provider.name)} className="w-11 h-11 rounded-md text-h1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 data-testid="provider-detail-name" className="text-h1 font-semibold m-0 text-primary truncate">{provider.name}</h2>
            {!editingKind ? (
              <button
                onClick={() => { setEditKindValue(provider.kind); setEditingKind(true); }}
                data-write
                aria-label="Change provider kind"
                className="cursor-pointer border-none bg-transparent p-0"
              >
                <ColoredBadge color={kindColor(provider.kind)} label={kindLabel(provider.kind)} />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <select
                  value={editKindValue}
                  onChange={e => setEditKindValue(e.target.value as ModelProviderKind)}
                  className={`${formInputCls} h-7 py-0 text-body-sm`}
                >
                  {PROVIDER_KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <Button
                  data-write size="sm" variant="primary" loading={updateKind.isPending}
                  onClick={() => updateKind.mutate({ provider, kind: editKindValue }, { onSuccess: () => setEditingKind(false) })}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingKind(false)}>Cancel</Button>
              </div>
            )}
          </div>
          <div className="font-mono text-body text-muted truncate">{provider.endpoint}</div>
        </div>
        <Button
          data-testid={`provider-delete-btn-${provider.id}`}
          variant="ghost"
          size="sm"
          leftIcon={<TrashIcon size={13} />}
          className="text-danger hover:text-danger"
          onClick={() => setConfirmDelete(true)}
        >
          Delete provider
        </Button>
      </div>

      <div className="mt-4 px-3.5 py-2.5 bg-card-2 rounded-md border border-hairline flex items-center gap-2.5">
        <span className="text-body-sm text-muted whitespace-nowrap">Upstream API key</span>
        <code className="flex-1 font-mono text-body text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
          {revealKey ? provider.upstreamApiKey : maskKey(provider.upstreamApiKey)}
        </code>
        <Button size="sm" variant="ghost" onClick={() => setRevealKey(v => !v)}>
          {revealKey ? 'Hide' : 'Reveal'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<CopyIcon size={12} />}
          onClick={() => { navigator.clipboard.writeText(provider.upstreamApiKey); toast('Upstream key copied', 'success'); }}
        >
          Copy
        </Button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          entityName={provider.name}
          onConfirm={() => delProvider.mutate(provider.id, { onSuccess: () => { setConfirmDelete(false); onDeleted(); } })}
          onCancel={() => setConfirmDelete(false)}
          loading={delProvider.isPending}
        />
      )}
    </div>
  );
}
