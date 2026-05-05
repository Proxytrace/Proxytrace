import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { providersApi } from '../../api/providers';
import { ModelProviderKind, type ApiKeyDto, type ModelEndpointDto, type ProviderDto } from '../../api/models';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { PlusIcon, TrashIcon, XIcon, EditIcon } from '../../components/icons';
import { Modal } from '../../components/overlays/Modal';
import { useToast } from '../../components/ui/Toast';
import { FormField, formInputCls } from '../../components/ui/FormField';
import { fmtDate } from '../../lib/format';

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
  return '#6b7280';
}
function providerColor(name: string) {
  const map: Record<string, string> = { Anthropic: '#3daa6f', OpenAI: '#c9944a', Google: '#6b9eaa', Azure: '#5b82b0', Mistral: '#d4915c' };
  return map[name] ?? '#c9944a';
}
function maskKey(k: string) {
  return k.length <= 8 ? '••••••••' : k.slice(0, 7) + '••••••••••••' + k.slice(-4);
}

export default function Providers() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'models' | 'keys'>('models');

  // Forms / dialog state
  const [showNewProvider, setShowNewProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', endpoint: '', upstreamApiKey: '', kind: ModelProviderKind.Anthropic, organizationId: '' });
  const [editingKind, setEditingKind] = useState(false);
  const [editKindValue, setEditKindValue] = useState<ModelProviderKind>(ModelProviderKind.Unknown);
  const [deleteProvider, setDeleteProvider] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [newModel, setNewModel] = useState({ modelName: '', inputTokenCost: '', outputTokenCost: '' });
  const [editingModel, setEditingModel] = useState<ModelEndpointDto | null>(null);
  const [editPricing, setEditPricing] = useState({ inputTokenCost: '', outputTokenCost: '' });
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', projectId: '' });
  const [deleteKey, setDeleteKey] = useState<ApiKeyDto | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKeyDto | null>(null);

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => providersApi.list({ pageSize: 200 }),
  });
  const { data: orgsData } = useQuery({ queryKey: ['organizations'], queryFn: providersApi.getOrganizations });
  const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: providersApi.getProjects });

  const providers = providersData?.items ?? [];
  const selected = providers.find(p => p.id === selectedId) ?? (providers.length > 0 && !selectedId ? providers[0] : null);
  const orgs = orgsData?.items ?? [];
  const projects = projectsData?.items ?? [];

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['provider-models', selectedId],
    queryFn: () => providersApi.getModels(selectedId!),
    enabled: !!selectedId,
  });
  const { data: keys = [], isLoading: keysLoading } = useQuery({
    queryKey: ['provider-keys', selectedId],
    queryFn: () => providersApi.getKeys(selectedId!),
    enabled: !!selectedId,
  });

  const createProvider = useMutation({
    mutationFn: () => providersApi.create({ ...newProvider, organizationId: newProvider.organizationId || (orgs[0]?.id ?? '') }),
    onSuccess: (p: { id: string }) => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      setShowNewProvider(false);
      setSelectedId(p.id);
    },
  });

  const updateKind = useMutation({
    mutationFn: () => providersApi.update(selected!.id, { name: selected!.name, endpoint: selected!.endpoint, upstreamApiKey: selected!.upstreamApiKey, kind: editKindValue }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['providers'] }); setEditingKind(false); },
  });

  const delProvider = useMutation({
    mutationFn: () => providersApi.delete(selectedId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      const remaining = providers.filter(p => p.id !== selectedId);
      setSelectedId(remaining[0]?.id ?? null);
      setDeleteProvider(false);
    },
  });

  const createModel = useMutation({
    mutationFn: () => providersApi.createModel(selectedId!, {
      modelName: newModel.modelName,
      inputTokenCost: newModel.inputTokenCost ? parseFloat(newModel.inputTokenCost) : null,
      outputTokenCost: newModel.outputTokenCost ? parseFloat(newModel.outputTokenCost) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['provider-models', selectedId] }); setShowNewModel(false); setNewModel({ modelName: '', inputTokenCost: '', outputTokenCost: '' }); },
  });

  const updatePricing = useMutation({
    mutationFn: () => providersApi.updateModelPricing(selectedId!, editingModel!.id, {
      inputTokenCost: editPricing.inputTokenCost ? parseFloat(editPricing.inputTokenCost) : null,
      outputTokenCost: editPricing.outputTokenCost ? parseFloat(editPricing.outputTokenCost) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['provider-models', selectedId] }); setEditingModel(null); },
  });

  const createKey = useMutation({
    mutationFn: () => providersApi.createKey(selectedId!, { name: newKey.name, projectId: newKey.projectId }),
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['provider-keys', selectedId] }); setShowNewKey(false); setNewlyCreatedKey(k); },
  });

  const delKey = useMutation({
    mutationFn: () => providersApi.deleteKey(selectedId!, deleteKey!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['provider-keys', selectedId] }); setDeleteKey(null); },
  });

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
    <div className="w-full max-w-[1400px] mx-auto min-w-0 flex flex-col gap-[14px] overflow-hidden pb-6 h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="fade-up flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.02em] m-0 mb-1">Providers</h1>
          <p className="text-[14px] text-muted m-0">Configure upstream model providers and manage Trsr API keys.</p>
        </div>
        <button className="btn-primary inline-flex items-center gap-[6px]" onClick={() => { setNewProvider({ name: '', endpoint: '', upstreamApiKey: '', kind: ModelProviderKind.Anthropic, organizationId: orgs[0]?.id ?? '' }); setShowNewProvider(true); }}>
          <PlusIcon size={13} />
          Add Provider
        </button>
      </div>

      {/* Master-detail */}
      <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr] gap-3">
        {/* Provider list */}
        <div className="bg-card rounded-2xl overflow-y-auto flex flex-col gap-[2px] p-2" style={{ boxShadow: 'var(--shadow-card)' }}>
          {providersLoading && <div className="text-center py-10 text-muted text-[13px]">Loading…</div>}
          {!providersLoading && providers.length === 0 && <div className="text-center p-[40px_16px] text-muted text-[13px]">No providers yet.</div>}
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => selectProvider(p)}
              className="w-full text-left p-[12px_14px] rounded-[10px] relative"
              style={{
                background: selectedId === p.id ? 'rgba(201,148,74,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-[10px]">
                <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 text-[13px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${providerColor(p.name)}cc, ${providerColor(p.name)}88)` }}>
                  {p.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[6px]">
                    <div className="text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</div>
                    <span className="shrink-0 px-[6px] py-[1px] rounded-full text-[10px] font-semibold" style={{ background: `${kindColor(p.kind)}22`, color: kindColor(p.kind) }}>{kindLabel(p.kind)}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted overflow-hidden text-ellipsis whitespace-nowrap">{p.organizationName}</div>
                </div>
              </div>
              {selectedId === p.id && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 bg-accent rounded-[0_2px_2px_0]" />}
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="bg-card rounded-2xl flex flex-col overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            {/* Provider header */}
            <div className="p-[18px_20px] border-b border-hairline shrink-0">
              <div className="flex items-start gap-[14px]">
                <div className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0 text-[18px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${providerColor(selected.name)}cc, ${providerColor(selected.name)}88)` }}>
                  {selected.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[10px] mb-1">
                    <h2 className="text-[18px] font-bold m-0">{selected.name}</h2>
                    {!editingKind ? (
                      <button
                        onClick={() => { setEditKindValue(selected.kind); setEditingKind(true); }}
                        className="px-2 py-[2px] rounded-full text-[11px] font-semibold"
                        style={{ background: `${kindColor(selected.kind)}22`, color: kindColor(selected.kind), border: 'none', cursor: 'pointer' }}
                      >
                        {kindLabel(selected.kind)}
                      </button>
                    ) : (
                      <div className="flex items-center gap-[6px]">
                        <select
                          value={editKindValue}
                          onChange={e => setEditKindValue(e.target.value as ModelProviderKind)}
                          className="px-2 py-[2px] rounded-full text-[11px] font-semibold outline-none cursor-pointer"
                          style={{ background: `${kindColor(editKindValue)}22`, color: kindColor(editKindValue), border: 'none' }}
                        >
                          {PROVIDER_KIND_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{o.label}</option>)}
                        </select>
                        <button className="btn-primary px-[10px] py-[2px] text-[11px] rounded-full" onClick={() => updateKind.mutate()} disabled={updateKind.isPending}>{updateKind.isPending ? '…' : 'Save'}</button>
                        <button onClick={() => setEditingKind(false)} className="px-2 py-[2px] rounded-full text-[11px] text-muted bg-card-2" style={{ border: 'none', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    )}
                    <span className="px-2 py-[2px] rounded-full text-[11px] bg-card-2 text-muted">{selected.organizationName}</span>
                  </div>
                  <div className="mono text-[12px] text-muted">{selected.endpoint}</div>
                </div>
                <button onClick={() => setDeleteProvider(true)} className="px-[10px] py-[6px] rounded-lg text-[12px] font-medium text-danger inline-flex items-center gap-[5px] shrink-0" style={{ background: 'rgba(217,85,85,0.08)', border: 'none', cursor: 'pointer' }}>
                  <TrashIcon size={13} /> Delete provider
                </button>
              </div>
              {/* Upstream key row */}
              <div className="mt-[14px] px-[14px] py-[10px] bg-card-2 rounded-[10px] flex items-center gap-[10px]">
                <span className="text-[12px] text-muted whitespace-nowrap">Upstream API key</span>
                <code className="flex-1 mono text-[12px] text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                  {revealKey ? selected.upstreamApiKey : maskKey(selected.upstreamApiKey)}
                </code>
                <button onClick={() => setRevealKey(v => !v)} className="text-[11px] text-muted px-2 py-[3px] rounded-md bg-card whitespace-nowrap" style={{ border: 'none', cursor: 'pointer' }}>
                  {revealKey ? 'Hide' : 'Reveal'}
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(selected.upstreamApiKey); toast('Upstream key copied', 'success'); }}
                  className="text-[11px] text-muted px-2 py-[3px] rounded-md bg-card whitespace-nowrap"
                  style={{ border: 'none', cursor: 'pointer' }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-hairline shrink-0 -mb-px">
              {(['models', 'keys'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-3 text-[13px] font-semibold cursor-pointer bg-transparent border-none -mb-px ${
                    tab === t
                      ? 'text-accent border-b-2 border-b-accent'
                      : 'text-muted border-b-2 border-b-transparent'
                  }`}
                >
                  {t === 'models' ? 'Models' : 'API Keys'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-[16px_20px] flex flex-col gap-[14px]">
              {tab === 'models' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-bold mb-[2px]">Models</div>
                      <div className="text-[12px] text-muted">Set pricing to compute trace costs.</div>
                    </div>
                    <button onClick={() => { setShowNewModel(true); setEditingModel(null); setNewModel({ modelName: '', inputTokenCost: '', outputTokenCost: '' }); }} className="px-3 py-[7px] bg-card-2 rounded-lg text-[12px] font-semibold inline-flex items-center gap-[6px]" style={{ border: 'none', cursor: 'pointer' }}>
                      + Add Model
                    </button>
                  </div>

                  {showNewModel && (
                    <div className="p-[14px_16px] bg-card-2 rounded-xl border border-hairline flex flex-col gap-[10px]">
                      <div className="text-[13px] font-semibold">Add Model</div>
                      <FormField label="Model name">
                        <input value={newModel.modelName} onChange={e => setNewModel(m => ({ ...m, modelName: e.target.value }))} placeholder="e.g. claude-sonnet-4-5" className={`${formInputCls} font-mono`} />
                      </FormField>
                      <div className="grid grid-cols-2 gap-[10px]">
                        <FormField label="Input cost / 1M tokens (€)">
                          <input type="number" value={newModel.inputTokenCost} onChange={e => setNewModel(m => ({ ...m, inputTokenCost: e.target.value }))} placeholder="e.g. 3.00" className={formInputCls} />
                        </FormField>
                        <FormField label="Output cost / 1M tokens (€)">
                          <input type="number" value={newModel.outputTokenCost} onChange={e => setNewModel(m => ({ ...m, outputTokenCost: e.target.value }))} placeholder="e.g. 15.00" className={formInputCls} />
                        </FormField>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button className="btn-ghost" onClick={() => setShowNewModel(false)}>Cancel</button>
                        <button className="btn-primary" onClick={() => createModel.mutate()} disabled={!newModel.modelName || createModel.isPending}>{createModel.isPending ? 'Adding…' : 'Add Model'}</button>
                      </div>
                    </div>
                  )}

                  {modelsLoading && <div className="text-center text-muted text-[13px] p-5">Loading models…</div>}
                  {!modelsLoading && models.length === 0 && !showNewModel && (
                    <div className="text-center text-muted text-[13px] p-6 border border-dashed border-hairline rounded-xl">
                      No models yet. Add one or let Trsr auto-discover them from traces.
                    </div>
                  )}
                  {models.length > 0 && (
                    <div className="bg-card-2 rounded-xl overflow-hidden">
                      <div className="grid p-[10px_16px] text-[11px] font-semibold text-muted tracking-[0.06em] uppercase border-b border-hairline" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}>
                        <span>Model</span><span>Input / 1M €</span><span>Output / 1M €</span><span />
                      </div>
                      {models.map((m, i) => (
                        <div key={m.id} className={i < models.length - 1 ? 'border-b border-hairline' : ''}>
                          <div className="grid p-[11px_16px] items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}>
                            <span className="mono text-[12px]">{m.modelName}</span>
                            <span className="text-[12px] text-secondary">{m.inputTokenCost != null ? m.inputTokenCost.toFixed(4) : '—'}</span>
                            <span className="text-[12px] text-secondary">{m.outputTokenCost != null ? m.outputTokenCost.toFixed(4) : '—'}</span>
                            <button onClick={() => { setEditingModel(m); setEditPricing({ inputTokenCost: m.inputTokenCost?.toString() ?? '', outputTokenCost: m.outputTokenCost?.toString() ?? '' }); setShowNewModel(false); }} className="btn-icon"><EditIcon size={13} /></button>
                          </div>
                          {editingModel?.id === m.id && (
                            <div className="p-[12px_16px_14px] bg-card border-t border-hairline flex flex-col gap-[10px]">
                              <div className="text-[12px] font-semibold text-secondary">Edit pricing for {m.modelName}</div>
                              <div className="grid grid-cols-2 gap-[10px]">
                                <FormField label="Input / 1M (€)">
                                  <input type="number" value={editPricing.inputTokenCost} onChange={e => setEditPricing(p => ({ ...p, inputTokenCost: e.target.value }))} placeholder="not set" className={formInputCls} />
                                </FormField>
                                <FormField label="Output / 1M (€)">
                                  <input type="number" value={editPricing.outputTokenCost} onChange={e => setEditPricing(p => ({ ...p, outputTokenCost: e.target.value }))} placeholder="not set" className={formInputCls} />
                                </FormField>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button className="btn-ghost" onClick={() => setEditingModel(null)}>Cancel</button>
                                <button className="btn-primary" onClick={() => updatePricing.mutate()} disabled={updatePricing.isPending}>{updatePricing.isPending ? 'Saving…' : 'Save'}</button>
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
                      <div className="text-[14px] font-bold mb-[2px]">Trsr API Keys</div>
                      <div className="text-[12px] text-muted">Keys that authenticate clients at the Trsr proxy.</div>
                    </div>
                    <button onClick={() => { setShowNewKey(true); setNewKey({ name: '', projectId: projects[0]?.id ?? '' }); }} className="px-3 py-[7px] bg-card-2 rounded-lg text-[12px] font-semibold inline-flex items-center gap-[6px]" style={{ border: 'none', cursor: 'pointer' }}>
                      + Generate Key
                    </button>
                  </div>

                  {newlyCreatedKey && (
                    <div className="p-[12px_16px] rounded-[11px] flex items-center gap-3" style={{ background: 'rgba(61,170,111,0.08)', border: '1px solid rgba(61,170,111,0.2)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold mb-1" style={{ color: '#3daa6f' }}>Key "{newlyCreatedKey.name}" created — copy it now</div>
                        <code className="text-[12px]" style={{ fontFamily: "'JetBrains Mono',monospace", wordBreak: 'break-all' }}>{newlyCreatedKey.keyValue}</code>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(newlyCreatedKey.keyValue); toast('API key copied', 'success'); }} className="px-3 py-[6px] rounded-[7px] text-[12px] font-semibold text-white whitespace-nowrap" style={{ background: '#3daa6f', border: 'none', cursor: 'pointer' }}>Copy</button>
                      <button onClick={() => setNewlyCreatedKey(null)} className="btn-icon"><XIcon size={14} /></button>
                    </div>
                  )}

                  {showNewKey && (
                    <div className="p-[14px_16px] bg-card-2 rounded-xl border border-hairline flex flex-col gap-[10px]">
                      <div className="text-[13px] font-semibold">Generate New Key</div>
                      <div className="grid grid-cols-2 gap-[10px]">
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
                        <button className="btn-ghost" onClick={() => setShowNewKey(false)}>Cancel</button>
                        <button className="btn-primary" onClick={() => createKey.mutate()} disabled={!newKey.name || !newKey.projectId || createKey.isPending}>{createKey.isPending ? 'Generating…' : 'Generate'}</button>
                      </div>
                    </div>
                  )}

                  {keysLoading && <div className="text-center text-muted text-[13px] p-5">Loading keys…</div>}
                  {!keysLoading && keys.length === 0 && !showNewKey && (
                    <div className="text-center text-muted text-[13px] p-10 border border-dashed border-hairline rounded-xl">
                      No API keys yet. Generate one to start proxying requests.
                    </div>
                  )}
                  {keys.length > 0 && (
                    <div className="bg-card-2 rounded-xl overflow-hidden">
                      <div className="grid p-[10px_16px] text-[11px] font-semibold text-muted tracking-[0.06em] uppercase border-b border-hairline" style={{ gridTemplateColumns: '1.5fr 1.2fr 2fr 1fr auto' }}>
                        <span>Name</span><span>Project</span><span>Key</span><span>Created</span><span />
                      </div>
                      {keys.map((key, i) => (
                        <div key={key.id} className={`grid p-[12px_16px] items-center ${i < keys.length - 1 ? 'border-b border-hairline' : ''}`} style={{ gridTemplateColumns: '1.5fr 1.2fr 2fr 1fr auto' }}>
                          <span className="text-[13px] font-semibold">{key.name}</span>
                          <span className="text-[12px] text-secondary">{key.projectName}</span>
                          <div className="flex items-center gap-[6px] min-w-0">
                            <code className="mono text-[12px] text-muted overflow-hidden text-ellipsis whitespace-nowrap flex-1">{maskKey(key.keyValue)}</code>
                            <button onClick={() => { navigator.clipboard.writeText(key.keyValue); toast('API key copied', 'success'); }} className="shrink-0 text-muted px-[6px] py-[3px] rounded-[5px] bg-card" style={{ border: 'none', cursor: 'pointer' }}>⧉</button>
                          </div>
                          <span className="text-[12px] text-muted">{fmtDate(key.createdAt)}</span>
                          <button onClick={() => setDeleteKey(key)} className="btn-icon btn-icon-danger"><TrashIcon size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl flex items-center justify-center text-muted text-sm" style={{ boxShadow: 'var(--shadow-card)' }}>
            Add your first provider to get started.
          </div>
        )}
      </div>

      {/* Add Provider Modal */}
      {showNewProvider && (
        <Modal title="Add Provider" onClose={() => setShowNewProvider(false)} maxWidth={460} footer={
          <>
            <button className="btn-ghost" onClick={() => setShowNewProvider(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => createProvider.mutate()} disabled={!newProvider.name || !newProvider.endpoint || !newProvider.upstreamApiKey || createProvider.isPending}>{createProvider.isPending ? 'Saving…' : 'Add Provider'}</button>
          </>
        }>
          <div className="flex flex-col gap-[14px]">
            {[
              { label: 'Provider name', key: 'name' as const, placeholder: 'e.g. Anthropic', type: 'text' },
              { label: 'Endpoint URL', key: 'endpoint' as const, placeholder: 'https://api.anthropic.com/v1', type: 'text', mono: true },
              { label: 'Upstream API key', key: 'upstreamApiKey' as const, placeholder: 'sk-ant-…', type: 'password', mono: true },
            ].map(f => (
              <FormField key={f.key} label={f.label}>
                <input
                  type={f.type}
                  value={newProvider[f.key]}
                  onChange={e => setNewProvider(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className={formInputCls}
                  style={f.mono ? { fontFamily: "'JetBrains Mono',monospace" } : undefined}
                />
              </FormField>
            ))}
            <FormField label="Provider Kind">
              <select value={newProvider.kind} onChange={e => setNewProvider(p => ({ ...p, kind: e.target.value as ModelProviderKind }))} className={formInputCls}>
                {PROVIDER_KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
            <FormField label="Organization">
              <select value={newProvider.organizationId} onChange={e => setNewProvider(p => ({ ...p, organizationId: e.target.value }))} className={formInputCls}>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
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
    </div>
  );
}
