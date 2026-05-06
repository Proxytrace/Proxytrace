import { EvaluatorKind, type ModelEndpointDto } from '../../api/models';
import { FormField, formInputCls } from '../../components/ui/FormField';

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

export function EvaluatorForm({ form, setForm, kind, endpoints }: {
  form: EvaluatorFormState;
  setForm: (f: EvaluatorFormState) => void;
  kind: EvaluatorKind | null;
  endpoints: ModelEndpointDto[];
}) {
  if (!kind) return null;
  const meta = META[kind];
  return (
    <div className="flex flex-col gap-3">
      {kind === EvaluatorKind.Custom && (
        <FormField label="Evaluator name">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My custom judge" className={formInputCls} />
        </FormField>
      )}
      {kind === EvaluatorKind.Custom && (
        <FormField label="System message (rubric prompt)">
          <textarea value={form.systemMessage} onChange={e => setForm({ ...form, systemMessage: e.target.value })} placeholder="You are a grader…" rows={5} className={`${formInputCls} resize-y`} />
        </FormField>
      )}
      {meta.requiresEndpoint && (
        <FormField label="Judge model endpoint">
          <select value={form.endpointId} onChange={e => setForm({ ...form, endpointId: e.target.value })} className={formInputCls}>
            {endpoints.map(ep => <option key={ep.id} value={ep.id}>{ep.providerName} · {ep.modelName}</option>)}
          </select>
        </FormField>
      )}
      {kind === EvaluatorKind.JsonSchemaMatch && (
        <FormField label="JSON Schema">
          <textarea value={form.jsonSchema} onChange={e => setForm({ ...form, jsonSchema: e.target.value })} placeholder='{"type":"object"…}' rows={5} className={`${formInputCls} resize-y`} />
        </FormField>
      )}
      {kind === EvaluatorKind.NumericMatch && (
        <FormField label="Extraction pattern (regex)">
          <input value={form.extractionPattern} onChange={e => setForm({ ...form, extractionPattern: e.target.value })} placeholder="score: (\d+)" className={formInputCls} />
        </FormField>
      )}
      {kind === EvaluatorKind.NumericMatch && (
        <FormField label="Tolerance">
          <input type="number" value={form.tolerance} onChange={e => setForm({ ...form, tolerance: e.target.value })} placeholder="0.01" className={formInputCls} />
        </FormField>
      )}
    </div>
  );
}
