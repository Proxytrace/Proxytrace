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

const inputCls = 'w-full px-3 py-[9px] bg-surface border border-border rounded-lg text-[13px] text-primary font-[inherit] outline-none';
const labelCls = 'text-[11px] font-semibold text-muted uppercase tracking-[0.05em]';

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
      <div className="flex flex-col gap-[5px]">
        <label className={labelCls}>{opts?.label ?? key}</label>
        {opts?.textarea ? (
          <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={opts?.placeholder} rows={5} className={inputCls} style={{ resize: 'vertical' }} />
        ) : (
          <input type={opts?.type ?? 'text'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={opts?.placeholder} className={inputCls} />
        )}
      </div>
    );
    return (
      <div className="flex flex-col gap-3">
        {kind === EvaluatorKind.Custom && inp('name', { label: 'Evaluator name', placeholder: 'My custom judge' })}
        {kind === EvaluatorKind.Custom && inp('systemMessage', { label: 'System message (rubric prompt)', placeholder: 'You are a grader…', textarea: true })}
        {meta.requiresEndpoint && (
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Judge model endpoint</label>
            <select value={form.endpointId} onChange={e => setForm({ ...form, endpointId: e.target.value })} className={inputCls}>
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
    <div className="flex gap-[14px] overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Left panel */}
      <div className="flex flex-col gap-[10px] overflow-hidden shrink-0 w-[320px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold m-0">Evaluators</h1>
          <button className="btn-primary inline-flex items-center gap-[5px] px-3 py-[7px] text-[12px]" onClick={() => { setCreateOpen(true); setPickedKind(null); setCreateForm(initForm()); }}>
            + New
          </button>
        </div>
        <FilterTabs options={filterTabs} value={typeFilter} onChange={v => setTypeFilter(v as Filter)} />
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {isLoading && <div className="text-center p-10 text-muted text-[13px]">Loading…</div>}
          {visible.map(e => {
            const c = EVALUATOR_KIND_COLOR[e.kind];
            const isActive = selected?.id === e.id;
            return (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className="w-full text-left rounded-[10px]"
                style={{
                  padding: '12px 14px', border: 'none', cursor: 'pointer',
                  background: isActive ? `${c}14` : 'var(--bg-card)',
                  borderLeft: isActive ? `3px solid ${c}` : '3px solid transparent',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-[2px] rounded-full text-[10px] font-semibold" style={{ background: `${c}22`, color: c }}>{META[e.kind]?.short}</span>
                  <span className="text-[13px] font-semibold flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{e.name}</span>
                </div>
              </button>
            );
          })}
          {!isLoading && visible.length === 0 && <div className="text-center p-10 text-muted text-[13px]">No evaluators match this filter.</div>}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div className="flex-1 bg-card rounded-2xl flex flex-col overflow-hidden min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-6 py-5 border-b border-hairline shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-[6px]">
                  <span className="px-[10px] py-[3px] rounded-full text-[11px] font-semibold" style={{ background: `${color}22`, color }}>{META[selected.kind]?.label}</span>
                </div>
                <h2 className="text-[18px] font-bold m-0 mb-1">{selected.name}</h2>
                <p className="text-[13px] text-muted m-0">{META[selected.kind]?.desc}</p>
              </div>
              <div className="flex gap-[6px]">
                <button onClick={() => openEdit(selected)} className="px-[10px] py-[6px] rounded-lg text-[12px] font-medium border border-border text-secondary" style={{ background: 'transparent', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => setDeleteTargetId(selected.id)} className="px-[10px] py-[6px] rounded-lg text-[12px] font-medium text-danger" style={{ background: 'rgba(217,85,85,0.08)', border: 'none', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-3 bg-card-2 rounded-[10px]">
                <div className="text-[11px] font-semibold text-muted mb-1 uppercase tracking-[0.06em]">Created</div>
                <div className="text-[13px]">{fmtDate(selected.createdAt)}</div>
              </div>
              {selected.endpointName && (
                <div className="px-4 py-3 bg-card-2 rounded-[10px]">
                  <div className="text-[11px] font-semibold text-muted mb-1 uppercase tracking-[0.06em]">Judge endpoint</div>
                  <div className="text-[13px]">{selected.endpointName}</div>
                </div>
              )}
            </div>
            {selected.systemMessage && <CodeBlock heading="System message" content={selected.systemMessage} maxLines={20} />}
            {selected.jsonSchema && <CodeBlock heading="JSON Schema" content={selected.jsonSchema} maxLines={20} language="json" />}
            {selected.extractionPattern && (
              <div className="px-4 py-3 bg-card-2 rounded-[10px]">
                <div className="text-[11px] font-semibold text-muted mb-1 uppercase tracking-[0.06em]">Extraction pattern</div>
                <code className="mono text-[13px]">{selected.extractionPattern}</code>
              </div>
            )}
            {selected.tolerance != null && (
              <div className="px-4 py-3 bg-card-2 rounded-[10px]">
                <div className="text-[11px] font-semibold text-muted mb-1 uppercase tracking-[0.06em]">Tolerance</div>
                <div className="text-[13px]">{selected.tolerance}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-card rounded-2xl flex items-center justify-center text-muted text-sm" style={{ boxShadow: 'var(--shadow-card)' }}>
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
            <div className="flex flex-col gap-[6px]">
              <p className="text-[13px] text-muted m-0 mb-[10px]">Choose an evaluator type:</p>
              <div className="grid grid-cols-2 gap-2">
                {KIND_ORDER.map(k => {
                  const c = EVALUATOR_KIND_COLOR[k];
                  return (
                    <button key={k} onClick={() => setPickedKind(k)} className="p-[12px_14px] rounded-[10px] text-left cursor-pointer" style={{ border: `1px solid ${c}33`, background: `${c}0a` }}>
                      <div className="text-[12px] font-bold mb-[3px]" style={{ color: c }}>{META[k].label}</div>
                      <div className="text-[11px] text-muted leading-[1.4]">{META[k].desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-[14px]">
              <div className="flex items-center gap-2">
                <span className="px-[10px] py-[3px] rounded-full text-[11px] font-semibold" style={{ background: `${EVALUATOR_KIND_COLOR[pickedKind]}22`, color: EVALUATOR_KIND_COLOR[pickedKind] }}>{META[pickedKind].label}</span>
                <button onClick={() => setPickedKind(null)} className="text-[11px] text-muted px-[6px] py-[2px] rounded-md border border-border" style={{ background: 'transparent', cursor: 'pointer' }}>← Change</button>
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
          <p className="text-[13px] text-secondary m-0">
            This will permanently remove the evaluator <strong>{deleteTarget.name}</strong> and detach it from all test suites.
          </p>
        </Modal>
      )}
    </div>
  );
}
