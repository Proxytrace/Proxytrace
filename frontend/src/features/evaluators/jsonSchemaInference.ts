/**
 * Infers a JSON Schema (draft 2020-12 compatible, matching the backend's JsonSchema.Net
 * validator) from an example JSON value. The result is a starting point — every observed
 * object key becomes required; users loosen it by hand where needed.
 */

export interface InferredJsonSchema {
  type: string;
  properties?: Record<string, InferredJsonSchema>;
  required?: string[];
  items?: InferredJsonSchema | { anyOf: InferredJsonSchema[] };
}

export function inferJsonSchema(value: unknown): InferredJsonSchema {
  if (value === null) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }
  if (typeof value === 'string') return { type: 'string' };
  if (Array.isArray(value)) return inferArraySchema(value);

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const schema: InferredJsonSchema = { type: 'object' };
  if (keys.length > 0) {
    schema.properties = Object.fromEntries(keys.map(k => [k, inferJsonSchema(obj[k])]));
    schema.required = keys;
  }
  return schema;
}

function inferArraySchema(value: unknown[]): InferredJsonSchema {
  if (value.length === 0) return { type: 'array' };
  const seen = new Map<string, InferredJsonSchema>();
  for (const element of value) {
    const schema = inferJsonSchema(element);
    seen.set(JSON.stringify(schema), schema);
  }
  const distinct = [...seen.values()];
  return {
    type: 'array',
    items: distinct.length === 1 ? distinct[0] : { anyOf: distinct },
  };
}

export type SchemaGenerationResult =
  | { ok: true; schema: string }
  | { ok: false; error: string };

/** Parses the pasted example and returns a pretty-printed schema, or a user-facing error. */
export function generateSchemaFromExample(exampleJson: string): SchemaGenerationResult {
  const trimmed = exampleJson.trim();
  if (!trimmed) return { ok: false, error: 'Paste an example JSON value first.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Not valid JSON — ${detail}` };
  }
  return { ok: true, schema: JSON.stringify(inferJsonSchema(parsed), null, 2) };
}
