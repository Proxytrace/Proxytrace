import { EvaluatorKind, type ModelEndpointDto } from '../../api/models';

export interface EvaluatorMeta { label: string; short: string; desc: string; requiresEndpoint: boolean; }

export const META: Record<EvaluatorKind, EvaluatorMeta> = {
  [EvaluatorKind.Custom]: { label: 'Custom LLM Judge', short: 'LLM judge', desc: 'A grader model scores responses against a custom rubric prompt.', requiresEndpoint: true },
  [EvaluatorKind.Helpfulness]: { label: 'Helpfulness', short: 'LLM judge', desc: 'Preset LLM judge that rates responses for helpfulness on a 1–5 scale.', requiresEndpoint: true },
  [EvaluatorKind.Politeness]: { label: 'Politeness', short: 'LLM judge', desc: 'Preset LLM judge that rates responses for politeness and tone.', requiresEndpoint: true },
  [EvaluatorKind.Safety]: { label: 'Safety Classifier', short: 'Classifier', desc: 'Preset LLM classifier that checks for harmful or policy-violating content.', requiresEndpoint: true },
  [EvaluatorKind.ExactMatch]: { label: 'Exact Match', short: 'Rule', desc: 'Passes when the agent response exactly matches the expected output.', requiresEndpoint: false },
  [EvaluatorKind.JsonSchemaMatch]: { label: 'JSON Schema Match', short: 'Rule', desc: 'Validates the agent response against a JSON Schema definition.', requiresEndpoint: false },
  [EvaluatorKind.NumericMatch]: { label: 'Numeric Match', short: 'Numeric', desc: 'Extract a number from the response and check it within a tolerance.', requiresEndpoint: false },
  [EvaluatorKind.ToolUsage]: { label: 'Tool Usage', short: 'Tool', desc: 'Preset LLM judge that checks whether the agent made the correct tool calls.', requiresEndpoint: true },
};

export const KIND_ORDER: EvaluatorKind[] = [
  EvaluatorKind.Custom, EvaluatorKind.ExactMatch, EvaluatorKind.NumericMatch,
  EvaluatorKind.Helpfulness, EvaluatorKind.Politeness, EvaluatorKind.JsonSchemaMatch,
  EvaluatorKind.Safety, EvaluatorKind.ToolUsage,
];

export type EvaluatorFormState = {
  name: string;
  systemMessage: string;
  endpointId: string;
  jsonSchema: string;
  extractionPattern: string;
  tolerance: string;
};

export function initForm(): EvaluatorFormState {
  return { name: '', systemMessage: '', endpointId: '', jsonSchema: '', extractionPattern: '', tolerance: '0.01' };
}

const inputCls = 'w-full px-3 py-[9px] bg-surface border border-border rounded-lg text-[13px] text-primary font-[inherit] outline-none';
const labelCls = 'text-[11px] font-semibold text-muted uppercase tracking-[0.05em]';

export function EvaluatorForm({ form, setForm, kind, endpoints }: {
  form: EvaluatorFormState;
  setForm: (f: EvaluatorFormState) => void;
  kind: EvaluatorKind | null;
  endpoints: ModelEndpointDto[];
}) {
  if (!kind) return null;
  const meta = META[kind];
  const inp = (key: keyof EvaluatorFormState, opts?: { label: string; placeholder?: string; type?: string; textarea?: boolean }) => (
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
