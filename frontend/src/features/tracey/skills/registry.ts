import type { TraceySkill } from './types';
import { optimizationSkill } from './optimization-skill';

/**
 * Every Tracey skill, keyed by id. Adding a skill is one entry here — it is then advertised in
 * the system-prompt catalog and loadable via `load_skill` with no other wiring.
 */
export const TRACEY_SKILLS: Record<string, TraceySkill> = {
  [optimizationSkill.id]: optimizationSkill,
};

/** All skills in registration order. */
export function listSkills(): TraceySkill[] {
  return Object.values(TRACEY_SKILLS);
}

/** Look up a skill by id. */
export function getSkill(id: string): TraceySkill | undefined {
  return TRACEY_SKILLS[id];
}

/**
 * The compact `id — description` catalog appended to Tracey's system prompt. Bodies stay out of
 * the base prompt; only these one-liners are always visible so the model knows what it can load.
 */
export function skillCatalog(): string {
  return listSkills()
    .map((skill) => `- \`${skill.id}\` — ${skill.description}`)
    .join('\n');
}
