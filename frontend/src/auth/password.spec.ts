import { describe, it, expect } from 'vitest';
import { passwordIsValid, rules } from './password';

describe('passwordIsValid', () => {
  it('accepts a password meeting every rule', () => {
    expect(passwordIsValid('Abcdef1!')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(passwordIsValid('Ab1!')).toBe(false);
  });

  it('rejects a password missing a lowercase letter', () => {
    expect(passwordIsValid('ABCDEF1!')).toBe(false);
  });

  it('rejects a password missing an uppercase letter', () => {
    expect(passwordIsValid('abcdef1!')).toBe(false);
  });

  it('rejects a password missing a special character', () => {
    expect(passwordIsValid('Abcdefg1')).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(passwordIsValid('')).toBe(false);
  });
});

describe('password rules', () => {
  it('each rule passes for a fully valid password and the labels are unique', () => {
    expect(rules.every((r) => r.test('Abcdef1!'))).toBe(true);
    const labels = rules.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
