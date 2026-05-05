import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { evaluatorsApi } from '../../api/evaluators';
import { providersApi } from '../../api/providers';
import { EvaluatorKind, type CreateEvaluatorPayload, type EvaluatorDetailDto } from '../../api/models';
import { FilterTabs } from '../../components/ui/FilterTabs';
import { Modal } from '../../components/overlays/Modal';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { fmtDate } from '../../lib/format';
import { EVALUATOR_KIND_COLOR } from '../../lib/colors';

interface EvaluatorMeta { label: string; short: string; desc: string; requiresEndpoint: boolean; }

const META: Record<EvaluatorKind, EvaluatorMeta> = {
  [EvaluatorKind.Custom]: { label: 'Custom LLM Judge', short: 'LLM judge', desc: 'A grader model scores responses against a custom rubric prompt.', requiresEndpoint: true },
  [EvaluatorKind.Helpfulness]: { label: 'Helpfulness', short: 'LLM judge', desc: 'Preset LLM judge that rates responses for helpfulness on a 1–5 scale.', requiresEndpoint: true },
  [EvaluatorKind.Politeness]: { label: 'Politeness', short: 'LLM judge', desc: 'Preset LLM judge that rates responses for politeness and tone.', requiresEndpoint: true },
  [EvaluatorKind.Safety]: { label: 'Safety Classifier', short: 'Classifier', desc: 'Preset LLM classifier that checks for harmful or policy-violating content.', requiresEndpoint: true },
  [EvaluatorKind.ExactMatch]: { label: 'Exact Match', short: 'Rule', desc: 'Passes when the agent response exactly matches the expected output.', requiresEndpoint: false },
  [EvaluatorKind.JsonSchemaMatch]: { label: 'JSON Schema Match', short: 'Rule', desc: 'Validates the agent response against a JSON Schema definition.', requiresEndpoint: false },
  [EvaluatorKind.NumericMatch]: { label: 'Numeric Match', short: 'Numeric', desc: 'Extract a number from the response and check it within a tolerance.', requiresEndpoint: false },
  [EvaluatorKind.ToolUsage]: { label: 'Tool Usage', short: 'Tool', desc: 'Preset LLM judge that checks whether the agent made the correct tool calls.', requiresEndpoint: true },
};

const KIND_ORDER: EvaluatorKind[] = [
  EvaluatorKind.Custom, EvaluatorKind.ExactMatch, EvaluatorKind.NumericMatch,
  EvaluatorKind.Helpfulness, EvaluatorKind.Politeness, EvaluatorKind.JsonSchemaMatch,
  EvaluatorKind.Safety, EvaluatorKind.ToolUsage,
];

type Filter = 'all' | 'llm' | 'rule' | 'numeric';

function initForm() { return { name: '', systemMessage: '', endpointId: '', jsonSchema: '', extractionPattern: '', tolerance: '0.01' }; }

export default function Evaluators() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pickedKind, setPickedKind] = useState<EvaluatorKind | null>(null);
  const [createForm, setCreateForm] = useState(initForm());
  const [editOpen, setEditOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(initForm());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: evaluators = [], isLoading } = useQuery({ queryKey: ['evaluators'], queryFn: evaluatorsApi.list });
  const { data: endpoints = [] } = useQuery({ queryKey: ['model-endpoints'], queryFn: providersApi.getAllModels });

  const visible = evaluators.filter(e => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'llm') return META[e.kind]?.requiresEndpoint;
    if (typeFilter === 'rule') return !META[e.kind]?.requiresEndpoint && e.kind !== EvaluatorKind.NumericMatch;
    if (typeFilter === 'numeric') return e.kind === EvaluatorKind.NumericMatch;
    return true;
  });

  const selected = evaluators.find(e => e.id === selectedId) ?? visible[0] ?? null;
  const editTarget = evaluators.find(e => e.id === editTargetId) ?? null;
  const deleteTarget = evaluators.find(e => e.id === deleteTargetId) ?? null;

  const filterTabs = [
    { label: 'All types', value: 'all', count: evaluators.length },
    { label: 'LLM judge', value: 'llm', count: evaluators.filter(e => META[e.kind]?.requiresEndpoint).length },
    { label: 'Rule', value: 'rule', count: evaluators.filter(e => !META[e.kind]?.requiresEndpoint && e.kind !== EvaluatorKind.NumericMatch).length },
    { label: 'Numeric', value: 'numeric', count: evaluators.filter(e => e.kind === EvaluatorKind.NumericMatch).length },
  ];

  const createEval = useMutation({
    mutationFn: () => {
      const k = pickedKind!;
      const payload: CreateEvaluatorPayload = { kind: k };
      if (k === EvaluatorKind.Custom) { payload.name = createForm.name; payload.systemMessage = createForm.systemMessage; payload.endpointId = createForm.endpointId || null; }
      else if (META[k].requiresEndpoint) { payload.endpointId = createForm.endpointId || null; }
      else if (k === EvaluatorKind.JsonSchemaMatch) { payload.jsonSchema = createForm.jsonSchema; }
      else if (k === EvaluatorKind.NumericMatch) { payload.extractionPattern = createForm.extractionPattern; payload.tolerance = parseFloat(createForm.tolerance) || 0.01; }
      return evaluatorsApi.create(payload);
    },
    onSuccess: (e) => { qc.invalidateQueries({ queryKey: ['evaluators'] }); setSelectedId(e.id); setCreateOpen(false); setPickedKind(null); },
  });

  const updateEval = useMutation({
    mutationFn: () => {
      const ev = editTarget!;
      const payload: Partial<CreateEvaluatorPayload> = {};
      if (ev.kind === EvaluatorKind.Custom) { payload.name = editForm.name; payload.systemMessage = editForm.systemMessage; payload.endpointId = editForm.endpointId || null; }
      else if (META[ev.kind]?.requiresEndpoint) { payload.endpointId = editForm.endpointId || null; }
      else if (ev.kind === EvaluatorKind.JsonSchemaMatch) { payload.jsonSchema = editForm.jsonSchema; }
      else if (ev.kind === EvaluatorKind.NumericMatch) { payload.extractionPattern = editForm.extractionPattern; payload.tolerance = parseFloat(editForm.tolerance) || 0.01; }
      return evaluatorsApi.update(ev.id, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evaluators'] }); setEditOpen(false); setEditTargetId(null); },
  });

  const deleteEval = useMutation({
    mutationFn: () => evaluatorsApi.delete(deleteTargetId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluators'] });
      if (selectedId === deleteTargetId) setSelectedId(null);
      setDeleteTargetId(null);
    },
  });

  function openEdit(e: EvaluatorDetailDto) {
    setEditTargetId(e.id);
    setEditForm({ name: e.name, systemMessage: e.systemMessage ?? '', endpointId: e.endpointId ?? '', jsonSchema: e.jsonSchema ?? '', extractionPattern: e.extractionPattern ?? '', tolerance: String(e.tolerance ?? 0.01) });
    setEditOpen(true);
  }

  const color = selected ? EVALUATOR_KIND_COLOR[selected.kind] : '#c9944a';

  function EvaluatorForm({ form, setForm, kind }: { form: typeof createForm; setForm: (f: typeof createForm) => void; kind: EvaluatorKind | null }) {
    if (!kind) return null;
    const meta = META[kind];
    const inp = (key: keyof typeof form, opts?: { label: string; placeholder?: string; type?: string; textarea?: boolean }) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{opts?.label ?? key}</label>
        {opts?.textarea ? (
          <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={opts?.placeholder} rows={5} style={{ padding: '9px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
        ) : (
          <input type={opts?.type ?? 'text'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={opts?.placeholder} style={{ padding: '9px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }} />
        )}
      </div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {kind === EvaluatorKind.Custom && inp('name', { label: 'Evaluator name', placeholder: 'My custom judge' })}
        {kind === EvaluatorKind.Custom && inp('systemMessage', { label: 'System message (rubric prompt)', placeholder: 'You are a grader…', textarea: true })}
        {meta.requiresEndpoint && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Judge model endpoint</label>
            <select value={form.endpointId} onChange={e => setForm({ ...form, endpointId: e.target.value })} style={{ padding: '9px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}>
              {endpoints.map(ep => <option key={ep.id} value={ep.id}>{ep.providerName} · {ep.modelName}</option>)}
            </select>
          </div>
        )}
        {kind === EvaluatorKind.JsonSchemaMatch && inp('jsonSchema', { label: 'JSON Schema', placeholder: '{"type":"object"…}', textarea: true })}
        {kind === EvaluatorKind.NumericMatch && inp('extractionPattern', { label: 'Extraction pattern (regex)', placeholder: 'score: (\\d+)' })}
        {kind === EvaluatorKind.NumericMatch && inp('tolerance', { label: 'Tolerance', placeholder: '0.01', type: 'number' })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 14, height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Evaluators</h1>
          <button className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12 }} onClick={() => { setCreateOpen(true); setPickedKind(null); setCreateForm(initForm()); }}>
            + New
          </button>
        </div>
        <FilterTabs options={filterTabs} value={typeFilter} onChange={v => setTypeFilter(v as Filter)} />
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isLoading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}
          {visible.map(e => {
            const c = EVALUATOR_KIND_COLOR[e.kind];
            const isActive = selected?.id === e.id;
            return (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: isActive ? `${c}14` : 'var(--bg-card)',
                  borderLeft: isActive ? `3px solid ${c}` : '3px solid transparent',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${c}22`, color: c }}>{META[e.kind]?.short}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                </div>
              </button>
            );
          })}
          {!isLoading && visible.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No evaluators match this filter.</div>}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${color}22`, color }}>{META[selected.kind]?.label}</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{selected.name}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{META[selected.kind]?.desc}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(selected)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Edit</button>
                <button onClick={() => setDeleteTargetId(selected.id)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'var(--danger)', background: 'rgba(217,85,85,0.08)', border: 'none', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '12px 16px', background: 'var(--bg-card-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Created</div>
                <div style={{ fontSize: 13 }}>{fmtDate(selected.createdAt)}</div>
              </div>
              {selected.endpointName && (
                <div style={{ padding: '12px 16px', background: 'var(--bg-card-2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Judge endpoint</div>
                  <div style={{ fontSize: 13 }}>{selected.endpointName}</div>
                </div>
              )}
            </div>
            {selected.systemMessage && <CodeBlock heading="System message" content={selected.systemMessage} maxLines={20} />}
            {selected.jsonSchema && <CodeBlock heading="JSON Schema" content={selected.jsonSchema} maxLines={20} language="json" />}
            {selected.extractionPattern && (
              <div style={{ padding: '12px 16px', background: 'var(--bg-card-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Extraction pattern</div>
                <code className="mono" style={{ fontSize: 13 }}>{selected.extractionPattern}</code>
              </div>
            )}
            {selected.tolerance != null && (
              <div style={{ padding: '12px 16px', background: 'var(--bg-card-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tolerance</div>
                <div style={{ fontSize: 13 }}>{selected.tolerance}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Select an evaluator to inspect it.
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <Modal title="New Evaluator" onClose={() => setCreateOpen(false)} maxWidth={520} footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => createEval.mutate()} disabled={!pickedKind || createEval.isPending}>{createEval.isPending ? 'Creating…' : 'Create'}</button>
          </>
        }>
          {!pickedKind ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>Choose an evaluator type:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {KIND_ORDER.map(k => {
                  const c = EVALUATOR_KIND_COLOR[k];
                  return (
                    <button key={k} onClick={() => setPickedKind(k)} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${c}33`, background: `${c}0a`, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: c, marginBottom: 3 }}>{META[k].label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{META[k].desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${EVALUATOR_KIND_COLOR[pickedKind]}22`, color: EVALUATOR_KIND_COLOR[pickedKind] }}>{META[pickedKind].label}</span>
                <button onClick={() => setPickedKind(null)} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}>← Change</button>
              </div>
              <EvaluatorForm form={createForm} setForm={setCreateForm} kind={pickedKind} />
            </div>
          )}
        </Modal>
      )}

      {/* Edit modal */}
      {editOpen && editTarget && (
        <Modal title={`Edit ${META[editTarget.kind]?.label ?? 'Evaluator'}`} onClose={() => { setEditOpen(false); setEditTargetId(null); }} maxWidth={520} footer={
          <>
            <button className="btn-ghost" onClick={() => { setEditOpen(false); setEditTargetId(null); }}>Cancel</button>
            <button className="btn-primary" onClick={() => updateEval.mutate()} disabled={updateEval.isPending}>{updateEval.isPending ? 'Saving…' : 'Save'}</button>
          </>
        }>
          <EvaluatorForm form={editForm} setForm={setEditForm} kind={editTarget.kind} />
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTargetId && deleteTarget && (
        <Modal
          title={`Delete "${deleteTarget.name}"`}
          onClose={() => setDeleteTargetId(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setDeleteTargetId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => deleteEval.mutate()} disabled={deleteEval.isPending}>{deleteEval.isPending ? 'Deleting…' : 'Delete'}</button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            This will permanently remove the evaluator <strong>{deleteTarget.name}</strong> and detach it from all test suites.
          </p>
        </Modal>
      )}
    </div>
  );
}
