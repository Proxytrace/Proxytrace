import { EvaluatorKind, type AgenticEvaluatorPresetDto } from '../../api/models';
import { FormField, formInputCls } from '../../components/ui/FormField';
import { Pill } from '../../components/ui/Pill';
import { CodeBlock } from '../../components/ui/CodeBlock';

export interface EvaluatorMeta { label: string; short: string; desc: string; }

export const META: Record<EvaluatorKind, EvaluatorMeta> = {
  [EvaluatorKind.Agentic]: { label: 'LLM Judge', short: 'LLM judge', desc: 'A grader model scores responses on a fixed 1–5 scale (Terrible → Excellent) with optional reasoning. Pick a preset or write your own rubric.' },
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
        <FormField label="Grading rubric">
          <textarea value={form.systemMessage} onChange={e => setForm({ ...form, systemMessage: e.target.value })} placeholder="You are a grader. Score how clearly the response answers the user's question. Use the 1–5 scale below; explain briefly in reasoning…" rows={8} className={`${formInputCls} resize-y`} />
          <div className="text-[11px] text-muted mt-1">Schema is appended automatically — only describe what to grade and what each score means.</div>
        </FormField>
      )}
      {kind === EvaluatorKind.Agentic && <OutputContractPanel />}
      {kind === EvaluatorKind.Agentic && <FinalPromptPreview rubric={form.systemMessage} />}
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

const SCORE_SCALE: { n: number; name: string; meaning: string; color: string }[] = [
  { n: 1, name: 'Terrible',   meaning: 'Completely wrong / unsafe', color: '#ef4444' },
  { n: 2, name: 'Bad',        meaning: 'Mostly wrong',              color: '#f97316' },
  { n: 3, name: 'Acceptable', meaning: 'Partially correct',         color: '#eab308' },
  { n: 4, name: 'Good',       meaning: 'Mostly correct',            color: '#84cc16' },
  { n: 5, name: 'Excellent',  meaning: 'Fully correct',             color: '#22c55e' },
];

function OutputContractPanel() {
  return (
    <div className="bg-card-2 border border-border rounded-[9px] p-3 flex flex-col gap-2">
      <div>
        <div className="text-[12px] font-semibold text-primary">Output contract</div>
        <div className="text-[11px] text-muted">Your rubric must produce one of these 5 scores; reasoning is optional.</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SCORE_SCALE.map(s => (
          <Pill key={s.n} label={`${s.n} · ${s.name} — ${s.meaning}`} color={s.color} size="sm" />
        ))}
      </div>
      <div className="text-[11px] text-muted">Reasoning — optional short explanation the judge attaches to the score.</div>
    </div>
  );
}

const APPENDED_SCHEMA_INSTRUCTION = `Respond only in JSON format that adheres to the following JSON schema definition:
{
  "type": "object",
  "properties": {
    "score":     { "enum": ["terrible","bad","acceptable","good","excellent"], "type": "string" },
    "reasoning": { "type": ["string","null"] }
  },
  "required": ["score"],
  "additionalProperties": false
}`;

function FinalPromptPreview({ rubric }: { rubric: string }) {
  const body = `${rubric.trim() || '<your rubric goes here>'}\n\n${APPENDED_SCHEMA_INSTRUCTION}`;
  return (
    <details className="group">
      <summary className="cursor-pointer text-[12px] font-medium text-accent select-none py-1">
        Preview final prompt sent to judge
      </summary>
      <div className="mt-2">
        <CodeBlock content={body} maxLines={20} />
      </div>
    </details>
  );
}
