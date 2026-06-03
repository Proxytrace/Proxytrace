import { getSkill, listSkills } from './skills/registry';

/**
 * Tracey's progressive tool disclosure. Every tool is always *defined* (so the backend still
 * captures and versions the full set from the wire), but only a subset is *active* — offered to
 * the model — on any given step. This keeps the per-turn tool payload lean and tool selection
 * sharp as the catalog grows.
 *
 * The active set is CORE plus the bundles of any skills loaded so far this turn (see
 * {@link activeToolNamesFor}). Loading a skill with `load_skill` unlocks its tools for the rest of
 * the turn, giving a dispatcher feel without a second model.
 */

/**
 * Tools active on every step, regardless of which skills have loaded. These are the conversational
 * and read/render essentials plus the simple, directly-wired write actions. Specialist tools live
 * in skill bundles and stay gated until their skill loads.
 */
export const CORE_TOOL_NAMES: readonly string[] = [
  'navigate',
  'search_docs',
  'load_skill',
  'list_agents',
  'get_agent',
  'list_suites',
  'get_suite',
  'list_runs',
  'get_run',
  'list_proposals',
  'get_proposal',
  'get_provider',
  'get_trace',
  'get_dashboard_stats',
  'start_test_run',
  'set_proposal_status',
  'show_chart',
  'show_table',
  'show_text',
  'ask_questions',
];

/**
 * The active tool names for a step: CORE plus the tool bundles of every skill loaded so far this
 * turn. Unknown skill ids are ignored. Returns a de-duplicated list; the AI SDK ignores any name
 * that isn't a defined tool, so callers don't need to cross-check against the tool set.
 */
export function activeToolNamesFor(loadedSkillIds: Iterable<string>): string[] {
  const active = new Set<string>(CORE_TOOL_NAMES);
  for (const id of loadedSkillIds) {
    const skill = getSkill(id);
    if (!skill?.tools) continue;
    for (const name of skill.tools) active.add(name);
  }
  return [...active];
}

/**
 * Every tool name reachable through disclosure: CORE plus every skill's bundle. Used by tests to
 * assert that no defined tool is permanently unreachable (in neither core nor any skill bundle).
 */
export function allDisclosableToolNames(): Set<string> {
  const names = new Set<string>(CORE_TOOL_NAMES);
  for (const skill of listSkills()) {
    for (const name of skill.tools ?? []) names.add(name);
  }
  return names;
}
