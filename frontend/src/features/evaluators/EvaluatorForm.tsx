import { EvaluatorKind, type AgenticEvaluatorPresetDto } from '../../api/models';
import { FormField } from '../../components/ui/FormField';
import { formInputCls } from '../../components/ui/classes';
import { Pill } from '../../components/ui/Pill';
import { CodeBlock } from '../../components/ui/CodeBlock';
import type { EvaluatorFormState } from './evaluatorMeta';

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
          <input data-testid="evaluator-form-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My judge" className={formInputCls} />
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
          <textarea data-testid="evaluator-form-jsonschema" value={form.jsonSchema} onChange={e => setForm({ ...form, jsonSchema: e.target.value })} placeholder='{"type":"object"…}' rows={5} className={`${formInputCls} resize-y`} />
        </FormField>
      )}
      {kind === EvaluatorKind.NumericMatch && (
        <FormField label="Extraction pattern (regex)">
          <input data-testid="evaluator-form-extractionpattern" value={form.extractionPattern} onChange={e => setForm({ ...form, extractionPattern: e.target.value })} placeholder="score: (\d+)" className={formInputCls} />
        </FormField>
      )}
      {kind === EvaluatorKind.NumericMatch && (
        <FormField label="Tolerance">
          <input data-testid="evaluator-form-tolerance" type="number" value={form.tolerance} onChange={e => setForm({ ...form, tolerance: e.target.value })} placeholder="0.01" className={formInputCls} />
        </FormField>
      )}
    </div>
  );
}

const SCORE_SCALE: { n: number; name: string; meaning: string; color: string }[] = [
  { n: 1, name: 'Terrible',   meaning: 'Completely wrong / unsafe', color: 'var(--danger)' },
  { n: 2, name: 'Bad',        meaning: 'Mostly wrong',              color: 'var(--warn)' },
  { n: 3, name: 'Acceptable', meaning: 'Partially correct',         color: 'var(--accent-primary)' },
  { n: 4, name: 'Good',       meaning: 'Mostly correct',            color: 'var(--teal)' },
  { n: 5, name: 'Excellent',  meaning: 'Fully correct',             color: 'var(--success)' },
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
