import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { generateSchemaFromExample } from '../jsonSchemaInference';

interface Props {
  /** Receives the generated, pretty-printed schema string. */
  onGenerate: (schema: string) => void;
}

/** Collapsed helper under the JSON Schema field: paste an example response, get a draft schema. */
export function SchemaFromExample({ onGenerate }: Props) {
  const [example, setExample] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    const result = generateSchemaFromExample(example);
    if (result.ok) {
      setError(null);
      onGenerate(result.schema);
    } else {
      setError(result.error);
    }
  };

  return (
    <details className="group">
      <summary className="cursor-pointer text-[12px] font-medium text-accent select-none py-1">
        Generate from an example JSON object
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <Textarea
          data-testid="schema-from-example-input"
          className="mono text-[12px]"
          value={example}
          onChange={e => { setExample(e.target.value); setError(null); }}
          placeholder='{"city": "Vienna", "tempC": 21.5, "sunny": true}'
          rows={5}
          invalid={!!error}
        />
        {error && <div className="text-[11px] text-danger">{error}</div>}
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted">
            Replaces the schema above — every example key becomes required; loosen by hand if needed.
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={generate}
            data-testid="schema-from-example-generate"
          >
            Generate schema
          </Button>
        </div>
      </div>
    </details>
  );
}
