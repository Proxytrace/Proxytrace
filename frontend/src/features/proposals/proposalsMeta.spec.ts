import { describe, it, expect } from 'vitest';
import { buildPromptDiff } from './proposalsMeta';

describe('buildPromptDiff', () => {
  it('returns empty array for two empty strings', () => {
    expect(buildPromptDiff('', '')).toEqual([{ kind: 'same', text: '' }]);
  });

  it('marks all lines as same when strings are identical', () => {
    const result = buildPromptDiff('line1\nline2', 'line1\nline2');
    expect(result).toEqual([
      { kind: 'same', text: 'line1' },
      { kind: 'same', text: 'line2' },
    ]);
  });

  it('marks a new line as add when it only appears in after', () => {
    const result = buildPromptDiff('old', 'old\nnew line');
    expect(result.some(r => r.kind === 'add' && r.text === 'new line')).toBe(true);
    expect(result.some(r => r.kind === 'same' && r.text === 'old')).toBe(true);
  });

  it('marks a removed line as del when it only appears in before', () => {
    const result = buildPromptDiff('old\nremoved', 'old');
    expect(result.some(r => r.kind === 'del' && r.text === 'removed')).toBe(true);
    expect(result.some(r => r.kind === 'same' && r.text === 'old')).toBe(true);
  });

  it('counts additions and deletions correctly', () => {
    const result = buildPromptDiff('a\nb\nc', 'a\nd\nc');
    const adds = result.filter(r => r.kind === 'add').length;
    const dels = result.filter(r => r.kind === 'del').length;
    const sames = result.filter(r => r.kind === 'same').length;
    expect(adds).toBe(1);
    expect(dels).toBe(1);
    expect(sames).toBe(2); // 'a' and 'c'
  });

  it('handles completely different strings', () => {
    const result = buildPromptDiff('only before', 'only after');
    expect(result.some(r => r.kind === 'del' && r.text === 'only before')).toBe(true);
    expect(result.some(r => r.kind === 'add' && r.text === 'only after')).toBe(true);
  });
});
