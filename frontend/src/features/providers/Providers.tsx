import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { providersApi } from '../../api/providers';
import { ModelProviderKind, type ApiKeyDto, type ModelEndpointDto, type ProviderDto } from '../../api/models';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { Modal } from '../../components/overlays/Modal';
import { useToast } from '../../components/ui/Toast';
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

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    padding: '9px 12px', background: 'var(--bg-card-2)', borderRadius: '9px',
    fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
    boxShadow: 'inset 0 0 0 1px var(--hairline)', width: '100%', border: 'none',
    fontFamily: 'inherit', ...extra,
  };
}

function labelStyle(): React.CSSProperties {
  return { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
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
    <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 80px)', overflow: 'hidden', paddingBottom: 24 }}>
      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Providers</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Configure upstream model providers and manage Trsr API keys.</p>
        </div>
        <button className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => { setNewProvider({ name: '', endpoint: '', upstreamApiKey: '', kind: ModelProviderKind.Anthropic, organizationId: orgs[0]?.id ?? '' }); setShowNewProvider(true); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Provider
        </button>
      </div>

      {/* Master-detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Provider list */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-card)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: 8 }}>
          {providersLoading && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}
          {!providersLoading && providers.length === 0 && <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No providers yet.</div>}
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => selectProvider(p)}
              style={{
                width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 10,
                background: selectedId === p.id ? 'rgba(201,148,74,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer', position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#fff',
                  background: `linear-gradient(135deg, ${providerColor(p.name)}cc, ${providerColor(p.name)}88)`,
                }}>
                  {p.name[0]}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <span style={{ flexShrink: 0, padding: '1px 6px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${kindColor(p.kind)}22`, color: kindColor(p.kind) }}>{kindLabel(p.kind)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono',monospace" }}>{p.organizationName}</div>
                </div>
              </div>
              {selectedId === p.id && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: '50%', background: 'var(--accent-primary)', borderRadius: '0 2px 2px 0' }} />}
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Provider header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 18, fontWeight: 700, color: '#fff',
                  background: `linear-gradient(135deg, ${providerColor(selected.name)}cc, ${providerColor(selected.name)}88)`,
                }}>
                  {selected.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selected.name}</h2>
                    {!editingKind ? (
                      <button
                        onClick={() => { setEditKindValue(selected.kind); setEditingKind(true); }}
                        style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${kindColor(selected.kind)}22`, color: kindColor(selected.kind), border: 'none', cursor: 'pointer' }}
                      >
                        {kindLabel(selected.kind)}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <select
                          value={editKindValue}
                          onChange={e => setEditKindValue(e.target.value as ModelProviderKind)}
                          style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${kindColor(editKindValue)}22`, color: kindColor(editKindValue), border: 'none', outline: 'none', cursor: 'pointer' }}
                        >
                          {PROVIDER_KIND_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{o.label}</option>)}
                        </select>
                        <button className="btn-primary" style={{ padding: '2px 10px', fontSize: 11, borderRadius: 100 }} onClick={() => updateKind.mutate()} disabled={updateKind.isPending}>{updateKind.isPending ? '…' : 'Save'}</button>
                        <button onClick={() => setEditingKind(false)} style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card-2)', border: 'none', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    )}
                    <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, background: 'var(--bg-card-2)', color: 'var(--text-muted)' }}>{selected.organizationName}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.endpoint}</div>
                </div>
                <button onClick={() => setDeleteProvider(true)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'var(--danger)', background: 'rgba(217,85,85,0.08)', display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  🗑 Delete provider
                </button>
              </div>
              {/* Upstream key row */}
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg-card-2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Upstream API key</span>
                <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {revealKey ? selected.upstreamApiKey : maskKey(selected.upstreamApiKey)}
                </code>
                <button onClick={() => setRevealKey(v => !v)} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {revealKey ? 'Hide' : 'Reveal'}
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(selected.upstreamApiKey); toast('Upstream key copied', 'success'); }}
                  style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
              {(['models', 'keys'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '12px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: tab === t ? 'var(--accent-primary)' : 'var(--text-muted)',
                    borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {t === 'models' ? 'Models' : 'API Keys'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tab === 'models' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Models</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Set pricing to compute trace costs.</div>
                    </div>
                    <button onClick={() => { setShowNewModel(true); setEditingModel(null); setNewModel({ modelName: '', inputTokenCost: '', outputTokenCost: '' }); }} style={{ padding: '7px 12px', background: 'var(--bg-card-2)', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer' }}>
                      + Add Model
                    </button>
                  </div>

                  {showNewModel && (
                    <div style={{ padding: '14px 16px', background: 'var(--bg-card-2)', borderRadius: 12, border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Add Model</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={labelStyle()}>Model name</label>
                        <input value={newModel.modelName} onChange={e => setNewModel(m => ({ ...m, modelName: e.target.value }))} placeholder="e.g. claude-sonnet-4-5" style={{ ...inputStyle(), fontFamily: "'JetBrains Mono',monospace" }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <label style={labelStyle()}>Input cost / 1M tokens (€)</label>
                          <input type="number" value={newModel.inputTokenCost} onChange={e => setNewModel(m => ({ ...m, inputTokenCost: e.target.value }))} placeholder="e.g. 3.00" style={inputStyle()} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <label style={labelStyle()}>Output cost / 1M tokens (€)</label>
                          <input type="number" value={newModel.outputTokenCost} onChange={e => setNewModel(m => ({ ...m, outputTokenCost: e.target.value }))} placeholder="e.g. 15.00" style={inputStyle()} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-ghost" onClick={() => setShowNewModel(false)}>Cancel</button>
                        <button className="btn-primary" onClick={() => createModel.mutate()} disabled={!newModel.modelName || createModel.isPending}>{createModel.isPending ? 'Adding…' : 'Add Model'}</button>
                      </div>
                    </div>
                  )}

                  {modelsLoading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Loading models…</div>}
                  {!modelsLoading && models.length === 0 && !showNewModel && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '24px', border: '1px dashed var(--hairline)', borderRadius: 12 }}>
                      No models yet. Add one or let Trsr auto-discover them from traces.
                    </div>
                  )}
                  {models.length > 0 && (
                    <div style={{ background: 'var(--bg-card-2)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--hairline)' }}>
                        <span>Model</span><span>Input / 1M €</span><span>Output / 1M €</span><span />
                      </div>
                      {models.map((m, i) => (
                        <div key={m.id} style={{ borderBottom: i < models.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', padding: '11px 16px', alignItems: 'center' }}>
                            <span className="mono" style={{ fontSize: 12 }}>{m.modelName}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.inputTokenCost != null ? m.inputTokenCost.toFixed(4) : '—'}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.outputTokenCost != null ? m.outputTokenCost.toFixed(4) : '—'}</span>
                            <button onClick={() => { setEditingModel(m); setEditPricing({ inputTokenCost: m.inputTokenCost?.toString() ?? '', outputTokenCost: m.outputTokenCost?.toString() ?? '' }); setShowNewModel(false); }} style={{ padding: '5px 8px', borderRadius: 7, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>✎</button>
                          </div>
                          {editingModel?.id === m.id && (
                            <div style={{ padding: '12px 16px 14px', background: 'var(--bg-card)', borderTop: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Edit pricing for {m.modelName}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  <label style={labelStyle()}>Input / 1M (€)</label>
                                  <input type="number" value={editPricing.inputTokenCost} onChange={e => setEditPricing(p => ({ ...p, inputTokenCost: e.target.value }))} placeholder="not set" style={inputStyle()} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  <label style={labelStyle()}>Output / 1M (€)</label>
                                  <input type="number" value={editPricing.outputTokenCost} onChange={e => setEditPricing(p => ({ ...p, outputTokenCost: e.target.value }))} placeholder="not set" style={inputStyle()} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Trsr API Keys</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Keys that authenticate clients at the Trsr proxy.</div>
                    </div>
                    <button onClick={() => { setShowNewKey(true); setNewKey({ name: '', projectId: projects[0]?.id ?? '' }); }} style={{ padding: '7px 12px', background: 'var(--bg-card-2)', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer' }}>
                      + Generate Key
                    </button>
                  </div>

                  {newlyCreatedKey && (
                    <div style={{ padding: '12px 16px', borderRadius: 11, background: 'rgba(61,170,111,0.08)', border: '1px solid rgba(61,170,111,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#3daa6f', marginBottom: 4 }}>Key "{newlyCreatedKey.name}" created — copy it now</div>
                        <code style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", wordBreak: 'break-all' }}>{newlyCreatedKey.keyValue}</code>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(newlyCreatedKey.keyValue); toast('API key copied', 'success'); }} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#3daa6f', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Copy</button>
                      <button onClick={() => setNewlyCreatedKey(null)} style={{ color: 'var(--text-muted)', padding: 4, border: 'none', cursor: 'pointer', background: 'transparent' }}>✕</button>
                    </div>
                  )}

                  {showNewKey && (
                    <div style={{ padding: '14px 16px', background: 'var(--bg-card-2)', borderRadius: 12, border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Generate New Key</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <label style={labelStyle()}>Key name</label>
                          <input value={newKey.name} onChange={e => setNewKey(k => ({ ...k, name: e.target.value }))} placeholder="e.g. production-agent" style={inputStyle()} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <label style={labelStyle()}>Project</label>
                          <select value={newKey.projectId} onChange={e => setNewKey(k => ({ ...k, projectId: e.target.value }))} style={{ ...inputStyle(), background: 'var(--bg-card)' }}>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-ghost" onClick={() => setShowNewKey(false)}>Cancel</button>
                        <button className="btn-primary" onClick={() => createKey.mutate()} disabled={!newKey.name || !newKey.projectId || createKey.isPending}>{createKey.isPending ? 'Generating…' : 'Generate'}</button>
                      </div>
                    </div>
                  )}

                  {keysLoading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Loading keys…</div>}
                  {!keysLoading && keys.length === 0 && !showNewKey && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '40px', border: '1px dashed var(--hairline)', borderRadius: 12 }}>
                      No API keys yet. Generate one to start proxying requests.
                    </div>
                  )}
                  {keys.length > 0 && (
                    <div style={{ background: 'var(--bg-card-2)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 2fr 1fr auto', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--hairline)' }}>
                        <span>Name</span><span>Project</span><span>Key</span><span>Created</span><span />
                      </div>
                      {keys.map((key, i) => (
                        <div key={key.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 2fr 1fr auto', padding: '12px 16px', alignItems: 'center', borderBottom: i < keys.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{key.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{key.projectName}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <code className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{maskKey(key.keyValue)}</code>
                            <button onClick={() => { navigator.clipboard.writeText(key.keyValue); toast('API key copied', 'success'); }} style={{ flexShrink: 0, color: 'var(--text-muted)', padding: '3px 6px', borderRadius: 5, background: 'var(--bg-card)', border: 'none', cursor: 'pointer' }}>⧉</button>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(key.createdAt)}</span>
                          <button onClick={() => setDeleteKey(key)} style={{ padding: '5px 8px', borderRadius: 7, color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Provider name', key: 'name' as const, placeholder: 'e.g. Anthropic', type: 'text' },
              { label: 'Endpoint URL', key: 'endpoint' as const, placeholder: 'https://api.anthropic.com/v1', type: 'text', mono: true },
              { label: 'Upstream API key', key: 'upstreamApiKey' as const, placeholder: 'sk-ant-…', type: 'password', mono: true },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle()}>{f.label}</label>
                <input
                  type={f.type}
                  value={newProvider[f.key]}
                  onChange={e => setNewProvider(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ ...inputStyle(), fontFamily: f.mono ? "'JetBrains Mono',monospace" : 'inherit' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle()}>Provider Kind</label>
              <select value={newProvider.kind} onChange={e => setNewProvider(p => ({ ...p, kind: e.target.value as ModelProviderKind }))} style={inputStyle()}>
                {PROVIDER_KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle()}>Organization</label>
              <select value={newProvider.organizationId} onChange={e => setNewProvider(p => ({ ...p, organizationId: e.target.value }))} style={inputStyle()}>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
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
