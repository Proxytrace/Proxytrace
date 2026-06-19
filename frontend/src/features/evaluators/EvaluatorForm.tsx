import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { EvaluatorKind, type AgenticEvaluatorPresetDto } from '../../api/models';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Pill } from '../../components/ui/Pill';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { SchemaFromExample } from './components/SchemaFromExample';
import type { EvaluatorFormState } from './evaluatorMeta';

export function EvaluatorForm({ form, setForm, kind, presets, showPresetPicker = true }: {
  form: EvaluatorFormState;
  setForm: (f: EvaluatorFormState) => void;
  kind: EvaluatorKind | null;
  presets: AgenticEvaluatorPresetDto[];
  showPresetPicker?: boolean;
}) {
  const { t } = useLingui();
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
        <FormField label={t`Preset`}>
          <Select value={form.presetKey} onValueChange={applyPreset}>
            <option value="">{t`Custom (write your own)`}</option>
            {presets.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
          </Select>
        </FormField>
      )}
      {kind === EvaluatorKind.Agentic && (
        <FormField label={t`Evaluator name`}>
          <Input data-testid="evaluator-form-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t`My judge`} />
        </FormField>
      )}
      {kind === EvaluatorKind.Agentic && (
        <FormField label={t`Grading rubric`}>
          <Textarea value={form.systemMessage} onChange={e => setForm({ ...form, systemMessage: e.target.value })} placeholder={t`You are a grader. Score how clearly the response answers the user's question. Use the 1–5 scale below; explain briefly in reasoning…`} rows={8} />
          <div className="text-[11px] text-muted mt-1"><Trans>Schema is appended automatically — only describe what to grade and what each score means.</Trans></div>
        </FormField>
      )}
      {kind === EvaluatorKind.Agentic && <OutputContractPanel />}
      {kind === EvaluatorKind.Agentic && <FinalPromptPreview rubric={form.systemMessage} />}
      {kind === EvaluatorKind.JsonSchemaMatch && (
        <FormField label={t`JSON Schema`}>
          <Textarea data-testid="evaluator-form-jsonschema" value={form.jsonSchema} onChange={e => setForm({ ...form, jsonSchema: e.target.value })} placeholder='{"type":"object"…}' rows={5} />
          <SchemaFromExample onGenerate={schema => setForm({ ...form, jsonSchema: schema })} />
        </FormField>
      )}
      {kind === EvaluatorKind.NumericMatch && (
        <FormField label={t`Extraction pattern (regex)`}>
          <Input data-testid="evaluator-form-extractionpattern" value={form.extractionPattern} onChange={e => setForm({ ...form, extractionPattern: e.target.value })} placeholder="score: (\d+)" />
        </FormField>
      )}
      {kind === EvaluatorKind.NumericMatch && (
        <FormField label={t`Tolerance`}>
          <Input data-testid="evaluator-form-tolerance" type="number" value={form.tolerance} onChange={e => setForm({ ...form, tolerance: e.target.value })} placeholder="0.01" />
        </FormField>
      )}
    </div>
  );
}

const SCORE_SCALE: { n: number; name: MessageDescriptor; meaning: MessageDescriptor; color: string }[] = [
  { n: 1, name: msg`Terrible`,   meaning: msg`Completely wrong / unsafe`, color: 'var(--danger)' },
  { n: 2, name: msg`Bad`,        meaning: msg`Mostly wrong`,              color: 'var(--warn)' },
  { n: 3, name: msg`Acceptable`, meaning: msg`Partially correct`,         color: 'var(--accent-primary)' },
  { n: 4, name: msg`Good`,       meaning: msg`Mostly correct`,            color: 'var(--teal)' },
  { n: 5, name: msg`Excellent`,  meaning: msg`Fully correct`,             color: 'var(--success)' },
];

function OutputContractPanel() {
  const { t, i18n } = useLingui();
  return (
    <div className="bg-card-2 border border-border rounded-[9px] p-3 flex flex-col gap-2">
      <div>
        <div className="text-[12px] font-semibold text-primary"><Trans>Output contract</Trans></div>
        <div className="text-[11px] text-muted"><Trans>Your rubric must produce one of these 5 scores; reasoning is optional.</Trans></div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SCORE_SCALE.map(s => (
          <Pill key={s.n} label={t`${s.n} · ${i18n._(s.name)} — ${i18n._(s.meaning)}`} color={s.color} size="sm" />
        ))}
      </div>
      <div className="text-[11px] text-muted"><Trans>Reasoning — optional short explanation the judge attaches to the score.</Trans></div>
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
        <Trans>Preview final prompt sent to judge</Trans>
      </summary>
      <div className="mt-2">
        <CodeBlock content={body} maxLines={20} />
      </div>
    </details>
  );
}
