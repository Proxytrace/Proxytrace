import { EvaluatorKind, type AgenticEvaluatorPresetDto } from '../../api/models';
import { FormField, formInputCls } from '../../components/ui/FormField';

export interface EvaluatorMeta { label: string; short: string; desc: string; }

export const META: Record<EvaluatorKind, EvaluatorMeta> = {
  [EvaluatorKind.Agentic]: { label: 'LLM Judge', short: 'LLM judge', desc: 'A grader model scores responses against a rubric prompt. Pick a preset or write your own.' },
  [EvaluatorKind.ExactMatch]: { label: 'Exact Match', short: 'Rule', desc: 'Passes when the agent response exactly matches the expected output.' },
  [EvaluatorKind.JsonSchemaMatch]: { label: 'JSON Schema Match', short: 'Rule', desc: 'Validates the agent response against a JSON Schema definition.' },
  [EvaluatorKind.NumericMatch]: { label: 'Numeric Match', short: 'Numeric', desc: 'Extract a number from the response and check it within a tolerance.' },
};

export const KIND_ORDER: EvaluatorKind[] = [
  EvaluatorKind.Agentic, EvaluatorKind.ExactMatch, EvaluatorKind.NumericMatch, EvaluatorKind.JsonSchemaMatch,
];

export type EvaluatorFormState = {
  name: string;
  systemMessage: string;
  presetKey: string;
  jsonSchema: string;
  extractionPattern: string;
  tolerance: string;
};

export function initForm(): EvaluatorFormState {
  return { name: '', systemMessage: '', presetKey: '', jsonSchema: '', extractionPattern: '', tolerance: '0.01' };
}

export function EvaluatorForm({ form, setForm, kind, presets, showPresetPicker = true }: {
  form: EvaluatorFormState;
  setForm: (f: EvaluatorFormState) => void;
  kind: EvaluatorKind | null;
  presets: AgenticEvaluatorPresetDto[];
  showPresetPicker?: boolean;
}) {
  if (!kind) return null;

  function applyPreset(key: string) {
    if (!key) {
      setForm({ ...form, presetKey: '' });
      return;
    }
    const p = presets.find(x => x.key === key);
    if (!p) return;
    setForm({ ...form, presetKey: key, name: p.name, systemMessage: p.systemPrompt });
  }

  return (
    <div className="flex flex-col gap-3">
      {kind === EvaluatorKind.Agentic && showPresetPicker && (
        <FormField label="Preset">
          <select value={form.presetKey} onChange={e => applyPreset(e.target.value)} className={formInputCls}>
            <option value="">Custom (write your own)</option>
            {presets.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
        </FormField>
      )}
      {kind === EvaluatorKind.Agentic && (
        <FormField label="Evaluator name">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My judge" className={formInputCls} />
        </FormField>
      )}
      {kind === EvaluatorKind.Agentic && (
        <FormField label="System message (rubric prompt)">
          <textarea value={form.systemMessage} onChange={e => setForm({ ...form, systemMessage: e.target.value })} placeholder="You are a grader…" rows={8} className={`${formInputCls} resize-y`} />
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
