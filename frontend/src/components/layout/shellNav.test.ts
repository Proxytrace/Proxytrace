import { describe, it, expect } from 'vitest';
import { navItems, DOCS_NAV_CODE } from './shellNav';

describe('nav page codes', () => {
  const codes = [...navItems.map(i => i.code), DOCS_NAV_CODE];

  it('is exactly two uppercase letters per entry', () => {
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it('is unique across every rail destination', () => {
    expect(new Set(codes).size).toBe(codes.length);
  });
});
