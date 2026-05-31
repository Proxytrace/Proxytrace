import { useState, type FormEvent } from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { EditIcon } from '../../../../components/icons';
import { Button } from '../../../../components/ui/Button';
import { FormField } from '../../../../components/ui/FormField';
import { Input } from '../../../../components/ui/Input';
import { Textarea } from '../../../../components/ui/Textarea';
import { useTraceyActions } from '../../tracey-actions';
import { ToolUIFrame } from './ToolUIFrame';

interface FormFieldSpec {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
  placeholder?: string;
}
interface FormArgs {
  title?: string;
  fields?: FormFieldSpec[];
  submitLabel?: string;
}

/** Inline renderer for the `show_form` tool: collects fields, submits them as the next turn. */
export const FormToolUI: ToolCallMessagePartComponent = ({ args }) => {
  const { sendUserMessage } = useTraceyActions();
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const { title, fields, submitLabel } = args as FormArgs;

  if (!fields || fields.length === 0) {
    return <ToolUIFrame state="pending" pendingLabel="Preparing form…" testId="tracey-form" />;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (submitted) return;
    setSubmitted(true);
    const lines = fields.map((f) => `${f.label}: ${values[f.name] ?? ''}`);
    sendUserMessage(lines.join('\n'));
  };

  return (
    <ToolUIFrame state="ready" title={title ?? 'Details'} icon={<EditIcon size={14} />} testId="tracey-form">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        {fields.map((field) => (
          <FormField key={field.name} label={field.label}>
            {field.type === 'textarea' ? (
              <Textarea
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                disabled={submitted}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                data-testid={`tracey-form-field-${field.name}`}
              />
            ) : (
              <Input
                type={field.type === 'number' ? 'number' : 'text'}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                disabled={submitted}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                data-testid={`tracey-form-field-${field.name}`}
              />
            )}
          </FormField>
        ))}
        <div>
          <Button type="submit" size="sm" disabled={submitted} data-testid="tracey-form-submit">
            {submitted ? 'Submitted' : (submitLabel ?? 'Submit')}
          </Button>
        </div>
      </form>
    </ToolUIFrame>
  );
};
