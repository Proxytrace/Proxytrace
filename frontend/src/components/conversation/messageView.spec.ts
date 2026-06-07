import { describe, it, expect } from 'vitest';
import { detectView, tryParseJson } from './messageView';

describe('tryParseJson', () => {
  it('parses a JSON object', () => {
    const r = tryParseJson('{"a": 1}');
    expect(r).toEqual({ ok: true, value: { a: 1 } });
  });

  it('parses a JSON array', () => {
    const r = tryParseJson('[1, 2, 3]');
    expect(r.ok).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(tryParseJson('  {"a":1}  ').ok).toBe(true);
  });

  it('rejects bare scalars so plain messages do not become JSON', () => {
    expect(tryParseJson('42').ok).toBe(false);
    expect(tryParseJson('"hello"').ok).toBe(false);
    expect(tryParseJson('true').ok).toBe(false);
  });

  it('rejects malformed JSON with an error', () => {
    const r = tryParseJson('{"a": }');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
  });

  it('rejects empty content', () => {
    expect(tryParseJson('   ').ok).toBe(false);
  });
});

describe('detectView', () => {
  it('detects JSON objects and arrays', () => {
    expect(detectView('{"a":1}')).toBe('json');
    expect(detectView('[1,2]')).toBe('json');
  });

  it('detects each Markdown signal', () => {
    expect(detectView('# Heading\nbody')).toBe('markdown');
    expect(detectView('- one\n- two')).toBe('markdown');
    expect(detectView('1. first\n2. second')).toBe('markdown');
    expect(detectView('some **bold** text')).toBe('markdown');
    expect(detectView('see [docs](https://x.dev)')).toBe('markdown');
    expect(detectView('```\ncode\n```')).toBe('markdown');
    expect(detectView('| a | b |\n| - | - |')).toBe('markdown');
  });

  it('falls back to raw for plain prose', () => {
    expect(detectView('Just a normal sentence with no markup.')).toBe('raw');
  });

  it('never auto-selects html', () => {
    expect(detectView('<div>hi</div>')).toBe('raw');
  });
});
