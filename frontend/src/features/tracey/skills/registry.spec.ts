import { describe, expect, it } from 'vitest';
import { getSkill, listSkills, skillCatalog, TRACEY_SKILLS } from './registry';

describe('tracey skills registry', () => {
  it('registers the optimize-agent skill', () => {
    expect(getSkill('optimize-agent')).toBeDefined();
    expect(getSkill('optimize-agent')?.name).toBe('Optimize an agent');
  });

  it('returns undefined for an unknown skill', () => {
    expect(getSkill('does-not-exist')).toBeUndefined();
  });

  it('lists every registered skill', () => {
    expect(listSkills()).toHaveLength(Object.keys(TRACEY_SKILLS).length);
    expect(listSkills().map((s) => s.id)).toContain('optimize-agent');
  });

  it('keys each skill by its own id', () => {
    for (const [key, skill] of Object.entries(TRACEY_SKILLS)) {
      expect(key).toBe(skill.id);
    }
  });

  it('builds a one-line catalog entry per skill', () => {
    const lines = skillCatalog().split('\n');
    expect(lines).toHaveLength(listSkills().length);
    for (const skill of listSkills()) {
      expect(skillCatalog()).toContain(`\`${skill.id}\``);
      expect(skillCatalog()).toContain(skill.description);
    }
  });
});
