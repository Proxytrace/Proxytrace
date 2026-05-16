import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { providersApi } from '../../api/providers';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { ModelProviderKind, type ApiKeyDto, type ModelEndpointDto, type ProviderDto } from '../../api/models';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { PlusIcon, TrashIcon, XIcon, EditIcon, CopyIcon } from '../../components/icons';
import { Modal, ModalFooter } from '../../components/overlays/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LIST_PAGE_SIZE } from '../../lib/constants';
import useToast from '../../hooks/useToast';
import { FormField } from '../../components/ui/FormField';
import { formInputCls } from '../../components/ui/classes';
import { fmtDate } from '../../lib/format';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { providerColor } from '../../lib/colors';

const PROVIDER_KIND_OPTIONS = [
  { value: ModelProviderKind.Anthropic, label: 'Anthropic' },
  { value: ModelProviderKind.OpenAi, label: 'OpenAI' },
  { value: ModelProviderKind.OpenAiCompatible, label: 'OpenAI-compatible' },
];

function kindLabel(k: ModelProviderKind) {
  return PROVIDER_KIND_OPTIONS.find(o => o.value === k)?.label ?? 'Unknown';
}
function kindColor(k: ModelProviderKind) {
  if (k === ModelProviderKind.Anthropic) return '#d4915c';
  if (k === ModelProviderKind.OpenAi) return '#3daa6f';
  if (k === ModelProviderKind.OpenAiCompatible) return '#6b9eaa';
  return '#67645e';
}
function maskKey(k: string) {
  return k.length <= 8 ? '••••••••' : k.slice(0, 7) + '••••••••••••' + k.slice(-4);
}

export default function Providers() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const { currentProjectId } = useCurrentProject();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'models' | 'keys'>('models');

  const [showNewProvider, setShowNewProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', endpoint: '', upstreamApiKey: '', kind: ModelProviderKind.Anthropic });
  const [editingKind, setEditingKind] = useState(false);
  const [editKindValue, setEditKindValue] = useState<ModelProviderKind>(ModelProviderKind.Unknown);
  const [deleteProvider, setDeleteProvider] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [newModel, setNewModel] = useState({ modelName: '', inputTokenCost: '', outputTokenCost: '' });
  const [editingModel, setEditingModel] = useState<ModelEndpointDto | null>(null);
  const [editPricing, setEditPricing] = useState({ inputTokenCost: '', outputTokenCost: '' });
  const [deleteModel, setDeleteModel] = useState<ModelEndpointDto | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', projectId: '' });
  const [deleteKey, setDeleteKey] = useState<ApiKeyDto | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKeyDto | null>(null);

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: QUERY_KEYS.providers,
    queryFn: () => providersApi.list({ pageSize: LIST_PAGE_SIZE }),
  });
  const { data: projectsData } = useQuery({ queryKey: QUERY_KEYS.projects, queryFn: providersApi.getProjects });

  const providers = providersData?.items ?? [];
  const selected = providers.find(p => p.id === selectedId) ?? (providers.length > 0 && !selectedId ? providers[0] : null);
  const activeId = selected?.id ?? null;
  const projects = projectsData?.items ?? [];

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: QUERY_KEYS.providerModels(activeId),
    queryFn: () => providersApi.getModels(activeId!),
    enabled: !!activeId,
  });
  const { data: availableModels, isLoading: availableLoading, error: availableError } = useQuery({
    queryKey: QUERY_KEYS.providerAvailableModels(activeId),
    queryFn: () => providersApi.getAvailableModels(activeId!),
    enabled: !!activeId && showNewModel,
    retry: false,
  });
  const existingModelNames = new Set(models.map(m => m.modelName));
  const selectableModels = (availableModels ?? []).filter(n => !existingModelNames.has(n));
  const { data: keys = [], isLoading: keysLoading } = useQuery({
    queryKey: QUERY_KEYS.providerKeys(activeId),
    queryFn: () => providersApi.getKeys(activeId!),
    enabled: !!activeId,
  });

  const createProvider = useMutation({
    mutationFn: () => providersApi.create({ ...newProvider }),
    onSuccess: (p: { id: string }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.providers });
      setShowNewProvider(false);
      setSelectedId(p.id);
    },
  });

  const updateKind = useMutation({
    mutationFn: () => providersApi.update(selected!.id, { name: selected!.name, endpoint: selected!.endpoint, upstreamApiKey: selected!.upstreamApiKey, kind: editKindValue }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.providers }); setEditingKind(false); },
  });

  const delProvider = useMutation({
    mutationFn: () => providersApi.delete(activeId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.providers });
      const remaining = providers.filter(p => p.id !== activeId);
      setSelectedId(remaining[0]?.id ?? null);
      setDeleteProvider(false);
    },
  });

  const createModel = useMutation({
    mutationFn: () => providersApi.createModel(activeId!, {
      modelName: newModel.modelName,
      inputTokenCost: newModel.inputTokenCost ? parseFloat(newModel.inputTokenCost) : null,
      outputTokenCost: newModel.outputTokenCost ? parseFloat(newModel.outputTokenCost) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.providerModels(activeId) }); setShowNewModel(false); setNewModel({ modelName: '', inputTokenCost: '', outputTokenCost: '' }); },
  });

  const delModel = useMutation({
    mutationFn: () => providersApi.deleteModel(deleteModel!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.providerModels(activeId) }); setDeleteModel(null); },
  });

  const updatePricing = useMutation({
    mutationFn: () => providersApi.updateModelPricing(activeId!, editingModel!.id, {
      inputTokenCost: editPricing.inputTokenCost ? parseFloat(editPricing.inputTokenCost) : null,
      outputTokenCost: editPricing.outputTokenCost ? parseFloat(editPricing.outputTokenCost) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.providerModels(activeId) }); setEditingModel(null); },
  });

  const createKey = useMutation({
    mutationFn: () => providersApi.createKey(activeId!, { name: newKey.name, projectId: newKey.projectId }),
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: QUERY_KEYS.providerKeys(activeId) }); setShowNewKey(false); setNewlyCreatedKey(k); },
  });

  const delKey = useMutation({
    mutationFn: () => providersApi.deleteKey(activeId!, deleteKey!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.providerKeys(activeId) }); setDeleteKey(null); },
  });

  const keysColumns: DataColumn<ApiKeyDto>[] = [
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
    { key: 'delete', label: '', width: 'auto', render: k => <IconButton aria-label="Delete key" danger onClick={() => setDeleteKey(k)}><TrashIcon size={13} /></IconButton> },
  ];

  function selectProvider(p: ProviderDto) {
    setSelectedId(p.id);
    setEditingKind(false);
    setShowNewModel(false);
    setShowNewKey(false);
    setEditingModel(null);
    setRevealKey(false);
    setNewlyCreatedKey(null);
  }

  return (
    <div className="w-full min-w-0 flex flex-col gap-4">
      {/* Page header */}
      <div className="fade-up flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-h1 font-semibold m-0 mb-1 text-primary">Providers</h1>
          <p className="text-body-sm text-muted m-0">Configure upstream model providers and manage Trsr API keys.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<PlusIcon size={14} />}
          onClick={() => { setNewProvider({ name: '', endpoint: '', upstreamApiKey: '', kind: ModelProviderKind.Anthropic }); setShowNewProvider(true); }}
        >
          Add provider
        </Button>
      </div>

      {/* Master-detail */}
      <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr] gap-3">
        {/* Provider list */}
        <Card elevation="raised" padding="sm" className="overflow-y-auto flex flex-col gap-1">
          {providersLoading && <div className="text-center py-10 text-muted text-body">Loading…</div>}
          {!providersLoading && providers.length === 0 && (
            <EmptyState title="No providers yet" description="Add a provider to route traffic through Trsr." />
          )}
          {providers.map(p => {
            const active = (selected?.id ?? null) === p.id;
            return (
              <button
                key={p.id}
                onClick={() => selectProvider(p)}
                className={
                  'group relative w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 border-none cursor-pointer ' +
                  'transition-[background,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)] ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] ' +
                  (active
                    ? 'bg-accent-subtle'
                    : 'bg-transparent hover:bg-card-2')
                }
              >
                {active && (
                  <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-accent rounded-r-sm" />
                )}
                <Avatar initials={p.name[0]} color={providerColor(p.name)} className="w-8 h-8 rounded-md text-title" />
                <div className="min-w-0 flex-1">
                  <div className="text-title font-semibold text-primary overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</div>
                  <div className="mt-0.5">
                    <ColoredBadge color={kindColor(p.kind)} label={kindLabel(p.kind)} />
                  </div>
                </div>
              </button>
            );
          })}
        </Card>

        {/* Detail panel */}
        {selected ? (
          <Card elevation="raised" padding="none" className="flex flex-col overflow-hidden">
            {/* Provider header */}
            <div className="p-5 border-b border-hairline shrink-0">
              <div className="flex items-start gap-3">
                <Avatar initials={selected.name[0]} color={providerColor(selected.name)} className="w-11 h-11 rounded-md text-h1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-h1 font-semibold m-0 text-primary truncate">{selected.name}</h2>
                    {!editingKind ? (
                      <button
                        onClick={() => { setEditKindValue(selected.kind); setEditingKind(true); }}
                        data-write
                        aria-label="Change provider kind"
                        className="cursor-pointer border-none bg-transparent p-0"
                      >
                        <ColoredBadge color={kindColor(selected.kind)} label={kindLabel(selected.kind)} />
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
                        <Button data-write size="sm" variant="primary" loading={updateKind.isPending} onClick={() => updateKind.mutate()}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingKind(false)}>Cancel</Button>
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-body text-muted truncate">{selected.endpoint}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<TrashIcon size={13} />}
                  className="text-danger hover:text-danger"
                  onClick={() => setDeleteProvider(true)}
                >
                  Delete provider
                </Button>
              </div>

              {/* Upstream key row */}
              <div className="mt-4 px-3.5 py-2.5 bg-card-2 rounded-md border border-hairline flex items-center gap-2.5">
                <span className="text-body-sm text-muted whitespace-nowrap">Upstream API key</span>
                <code className="flex-1 font-mono text-body text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                  {revealKey ? selected.upstreamApiKey : maskKey(selected.upstreamApiKey)}
                </code>
                <Button size="sm" variant="ghost" onClick={() => setRevealKey(v => !v)}>
                  {revealKey ? 'Hide' : 'Reveal'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<CopyIcon size={12} />}
                  onClick={() => { navigator.clipboard.writeText(selected.upstreamApiKey); toast('Upstream key copied', 'success'); }}
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-hairline shrink-0 px-2">
              {(['models', 'keys'] as const).map(t => {
                const count = t === 'models' ? models.length : keys.length;
                const active = tab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={
                      'relative px-4 py-3 text-title font-semibold cursor-pointer bg-transparent border-none ' +
                      'transition-colors duration-[var(--motion-base)] ease-[var(--ease-standard)] ' +
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] focus-visible:rounded-sm ' +
                      (active ? 'text-accent' : 'text-muted hover:text-primary')
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      {t === 'models' ? 'Models' : 'API keys'}
                      {count > 0 && (
                        <span className={`text-caption font-semibold px-1.5 py-px rounded-full ${active ? 'bg-accent-subtle text-accent' : 'bg-card-2 text-muted'}`}>
                          {count}
                        </span>
                      )}
                    </span>
                    {active && (
                      <span aria-hidden className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {tab === 'models' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-h2 font-semibold text-primary mb-0.5">Models</div>
                      <div className="text-body-sm text-muted">Set pricing to compute trace costs.</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<PlusIcon size={13} />}
                      onClick={() => { setShowNewModel(true); setEditingModel(null); setNewModel({ modelName: '', inputTokenCost: '', outputTokenCost: '' }); }}
                    >
                      Add model
                    </Button>
                  </div>

                  {showNewModel && (
                    <div className="p-4 bg-card-2 rounded-lg border border-hairline flex flex-col gap-3">
                      <div className="text-title font-semibold text-primary">Add model</div>
                      <FormField label="Model">
                        {availableLoading ? (
                          <div className="text-body text-muted py-2">Discovering available models…</div>
                        ) : availableError ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="text-body text-danger">Could not discover models from endpoint. Enter manually:</div>
                            <input value={newModel.modelName} onChange={e => setNewModel(m => ({ ...m, modelName: e.target.value }))} placeholder="e.g. claude-sonnet-4-5" className={`${formInputCls} font-mono`} />
                          </div>
                        ) : selectableModels.length === 0 ? (
                          <div className="text-body text-muted py-2">All discovered models are already added.</div>
                        ) : (
                          <select value={newModel.modelName} onChange={e => setNewModel(m => ({ ...m, modelName: e.target.value }))} className={`${formInputCls} font-mono`}>
                            <option value="">Select a model…</option>
                            {selectableModels.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        )}
                      </FormField>
                      <div className="grid grid-cols-2 gap-2.5">
                        <FormField label="Input cost / 1M tokens (€)">
                          <input type="number" value={newModel.inputTokenCost} onChange={e => setNewModel(m => ({ ...m, inputTokenCost: e.target.value }))} placeholder="e.g. 3.00" className={formInputCls} />
                        </FormField>
                        <FormField label="Output cost / 1M tokens (€)">
                          <input type="number" value={newModel.outputTokenCost} onChange={e => setNewModel(m => ({ ...m, outputTokenCost: e.target.value }))} placeholder="e.g. 15.00" className={formInputCls} />
                        </FormField>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setShowNewModel(false)}>Cancel</Button>
                        <Button data-write variant="primary" size="sm" loading={createModel.isPending} disabled={!newModel.modelName} onClick={() => createModel.mutate()}>
                          Add model
                        </Button>
                      </div>
                    </div>
                  )}

                  {modelsLoading && <div className="text-center text-muted text-body p-5">Loading models…</div>}
                  {!modelsLoading && models.length === 0 && !showNewModel && (
                    <EmptyState title="No models yet" description="Add one or let Trsr auto-discover them from traces." />
                  )}
                  {models.length > 0 && (
                    <div className="bg-card-2 rounded-lg border border-hairline overflow-hidden">
                      <div className="grid px-4 py-2.5 text-caption font-semibold text-muted tracking-[0.07em] uppercase border-b border-hairline" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}>
                        <span>Model</span><span>Input / 1M €</span><span>Output / 1M €</span><span />
                      </div>
                      {models.map((m, i) => (
                        <div key={m.id} className={i < models.length - 1 ? 'border-b border-hairline' : ''}>
                          <div className="grid px-4 py-2.5 items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}>
                            <span className="font-mono text-body text-primary">{m.modelName}</span>
                            <span className="text-body text-secondary">{m.inputTokenCost != null ? m.inputTokenCost.toFixed(4) : '—'}</span>
                            <span className="text-body text-secondary">{m.outputTokenCost != null ? m.outputTokenCost.toFixed(4) : '—'}</span>
                            <div className="flex items-center gap-1">
                              <IconButton aria-label="Edit pricing" onClick={() => { setEditingModel(m); setEditPricing({ inputTokenCost: m.inputTokenCost?.toString() ?? '', outputTokenCost: m.outputTokenCost?.toString() ?? '' }); setShowNewModel(false); }}>
                                <EditIcon size={13} />
                              </IconButton>
                              <IconButton aria-label="Delete model" danger onClick={() => setDeleteModel(m)}>
                                <TrashIcon size={13} />
                              </IconButton>
                            </div>
                          </div>
                          {editingModel?.id === m.id && (
                            <div className="px-4 py-3.5 bg-card border-t border-hairline flex flex-col gap-3">
                              <div className="text-body-sm font-semibold text-secondary">Edit pricing for <span className="font-mono text-primary">{m.modelName}</span></div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <FormField label="Input / 1M (€)">
                                  <input type="number" value={editPricing.inputTokenCost} onChange={e => setEditPricing(p => ({ ...p, inputTokenCost: e.target.value }))} placeholder="not set" className={formInputCls} />
                                </FormField>
                                <FormField label="Output / 1M (€)">
                                  <input type="number" value={editPricing.outputTokenCost} onChange={e => setEditPricing(p => ({ ...p, outputTokenCost: e.target.value }))} placeholder="not set" className={formInputCls} />
                                </FormField>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setEditingModel(null)}>Cancel</Button>
                                <Button data-write variant="primary" size="sm" loading={updatePricing.isPending} onClick={() => updatePricing.mutate()}>Save</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'keys' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-h2 font-semibold text-primary mb-0.5">Trsr API keys</div>
                      <div className="text-body-sm text-muted">Keys that authenticate clients at the Trsr proxy.</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<PlusIcon size={13} />}
                      onClick={() => { setShowNewKey(true); setNewKey({ name: '', projectId: currentProjectId ?? projects[0]?.id ?? '' }); }}
                    >
                      Generate key
                    </Button>
                  </div>

                  {newlyCreatedKey && (
                    <div className="px-4 py-3 rounded-lg flex items-center gap-3 bg-success-subtle border border-[color-mix(in_srgb,var(--success)_28%,transparent)]">
                      <div className="flex-1 min-w-0">
                        <div className="text-body font-semibold mb-1 text-success">Key "{newlyCreatedKey.name}" created — copy it now</div>
                        <code className="font-mono text-body text-primary break-all">{newlyCreatedKey.keyValue}</code>
                      </div>
                      <Button variant="success" size="sm" leftIcon={<CopyIcon size={12} />} onClick={() => { navigator.clipboard.writeText(newlyCreatedKey.keyValue); toast('API key copied', 'success'); }}>Copy</Button>
                      <IconButton aria-label="Dismiss" onClick={() => setNewlyCreatedKey(null)}><XIcon size={14} /></IconButton>
                    </div>
                  )}

                  {showNewKey && (
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
                        <Button variant="ghost" size="sm" onClick={() => setShowNewKey(false)}>Cancel</Button>
                        <Button data-write variant="primary" size="sm" loading={createKey.isPending} disabled={!newKey.name || !newKey.projectId} onClick={() => createKey.mutate()}>Generate</Button>
                      </div>
                    </div>
                  )}

                  {keysLoading && <div className="text-center text-muted text-body p-5">Loading keys…</div>}
                  {!keysLoading && keys.length === 0 && !showNewKey && (
                    <EmptyState title="No API keys yet" description="Generate one to start proxying requests." />
                  )}
                  {keys.length > 0 && (
                    <div className="bg-card-2 rounded-lg border border-hairline overflow-hidden">
                      <DataTable columns={keysColumns} rows={keys} rowKey={k => k.id} />
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        ) : (
          <Card elevation="raised" padding="lg" className="flex items-center justify-center text-muted text-body">
            Add your first provider to get started.
          </Card>
        )}
      </div>

      {/* Add Provider Modal */}
      {showNewProvider && (
        <Modal title="Add provider" onClose={() => setShowNewProvider(false)} maxWidth={460} footer={
          <ModalFooter onCancel={() => setShowNewProvider(false)} onSubmit={() => createProvider.mutate()} submitLabel={createProvider.isPending ? 'Saving…' : 'Add provider'} loading={createProvider.isPending} disabled={!newProvider.name || !newProvider.endpoint || !newProvider.upstreamApiKey} />
        }>
          <div className="flex flex-col gap-3.5">
            {[
              { label: 'Provider name', key: 'name' as const, placeholder: 'e.g. Anthropic', type: 'text', mono: false },
              { label: 'Endpoint URL', key: 'endpoint' as const, placeholder: 'https://api.anthropic.com/v1', type: 'text', mono: true },
              { label: 'Upstream API key', key: 'upstreamApiKey' as const, placeholder: 'sk-ant-…', type: 'password', mono: true },
            ].map(f => (
              <FormField key={f.key} label={f.label}>
                <input
                  type={f.type}
                  value={newProvider[f.key]}
                  onChange={e => setNewProvider(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className={`${formInputCls} ${f.mono ? 'font-mono' : ''}`}
                />
              </FormField>
            ))}
            <FormField label="Provider kind">
              <select value={newProvider.kind} onChange={e => setNewProvider(p => ({ ...p, kind: e.target.value as ModelProviderKind }))} className={formInputCls}>
                {PROVIDER_KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
          </div>
        </Modal>
      )}

      {/* Delete Provider */}
      {deleteProvider && selected && (
        <ConfirmDialog entityName={selected.name} onConfirm={() => delProvider.mutate()} onCancel={() => setDeleteProvider(false)} loading={delProvider.isPending} />
      )}

      {/* Delete Key */}
      {deleteKey && (
        <ConfirmDialog entityName={deleteKey.name} onConfirm={() => delKey.mutate()} onCancel={() => setDeleteKey(null)} loading={delKey.isPending} />
      )}

      {/* Delete Model */}
      {deleteModel && (
        <ConfirmDialog entityName={deleteModel.modelName} onConfirm={() => delModel.mutate()} onCancel={() => setDeleteModel(null)} loading={delModel.isPending} />
      )}
    </div>
  );
}
