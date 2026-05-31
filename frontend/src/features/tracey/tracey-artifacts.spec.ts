import { describe, it, expect } from 'vitest';
import { resultToArtifact, withId } from './tracey-artifacts';

describe('resultToArtifact', () => {
  it('turns a flat array of objects into a table', () => {
    const artifact = resultToArtifact('Agents', [
      { id: 'a1', name: 'A' },
      { id: 'a2', name: 'B', extra: 3 },
    ]);

    expect(artifact.kind).toBe('table');
    if (artifact.kind !== 'table') throw new Error('expected table');
    expect(artifact.columns).toEqual(['id', 'name', 'extra']);
    expect(artifact.rows).toEqual([
      ['a1', 'A', ''],
      ['a2', 'B', 3],
    ]);
  });

  it('falls back to a JSON text artifact for non-tabular data', () => {
    const artifact = resultToArtifact('Stats', { total: 5, nested: { a: 1 } });

    expect(artifact.kind).toBe('text');
    if (artifact.kind !== 'text') throw new Error('expected text');
    expect(artifact.format).toBe('json');
    expect(artifact.content).toContain('"total": 5');
  });

  it('passes a string result through as-is', () => {
    const artifact = resultToArtifact('Raw', 'hello');
    if (artifact.kind !== 'text') throw new Error('expected text');
    expect(artifact.content).toBe('hello');
  });
});

describe('withId', () => {
  it('assigns a unique id and preserves the payload', () => {
    const a = withId({ kind: 'text', title: 'T', format: 'code', content: 'x' });
    const b = withId({ kind: 'text', title: 'T', format: 'code', content: 'x' });

    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect(a.title).toBe('T');
  });
});
