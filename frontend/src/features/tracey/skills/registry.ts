import type { TraceySkill } from './types';

/**
 * Parses a skill markdown file (YAML front-matter + body) into a {@link TraceySkill}. The
 * front-matter must define `name` and `description`; everything after it is the playbook body.
 */
function parseSkill(raw: string): TraceySkill {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(raw);
  if (!match) {
    throw new Error('Skill markdown is missing YAML front-matter.');
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = value;
  }

  if (!meta.name || !meta.description) {
    throw new Error('Skill front-matter must define `name` and `description`.');
  }

  return { name: meta.name, description: meta.description, instructions: raw.slice(match[0].length).trim() };
}

// Every `*.md` in this folder is a skill — inlined at build time via Vite's `?raw`. Adding a
// skill is dropping a markdown file here; no registration code to touch.
const files = import.meta.glob<string>('./*.md', { query: '?raw', import: 'default', eager: true });

/** Every Tracey skill, keyed by its front-matter `name`. */
export const TRACEY_SKILLS: Record<string, TraceySkill> = Object.fromEntries(
  Object.values(files).map((raw) => {
    const skill = parseSkill(raw);
    return [skill.name, skill];
  }),
);

/** All skills in load order. */
export function listSkills(): TraceySkill[] {
  return Object.values(TRACEY_SKILLS);
}

/** Look up a skill by its `name`. */
export function getSkill(name: string): TraceySkill | undefined {
  return TRACEY_SKILLS[name];
}

/**
 * The compact `name — description` catalog appended to Tracey's system prompt. Bodies stay out of
 * the base prompt; only these one-liners are always visible so the model knows what it can load.
 */
export function skillCatalog(): string {
  return listSkills()
    .map((skill) => `- \`${skill.name}\` — ${skill.description}`)
    .join('\n');
}
