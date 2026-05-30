import { describe, it, expect } from 'vitest';
import { diffLines } from './diffLines';

describe('diffLines', () => {
  it('marks every line same when texts are identical', () => {
    const rows = diffLines('a\nb\nc', 'a\nb\nc');
    expect(rows).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'same', text: 'b' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('detects an inserted line', () => {
    const rows = diffLines('a\nc', 'a\nb\nc');
    expect(rows).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'add', text: 'b' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('detects a removed line', () => {
    const rows = diffLines('a\nb\nc', 'a\nc');
    expect(rows).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('represents a changed line as a delete plus an add', () => {
    const rows = diffLines('hello world', 'hello there');
    expect(rows).toEqual([
      { kind: 'del', text: 'hello world' },
      { kind: 'add', text: 'hello there' },
    ]);
  });
});
