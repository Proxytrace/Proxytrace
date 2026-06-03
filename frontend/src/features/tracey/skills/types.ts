/**
 * A Tracey skill: a named, on-demand playbook. Only the `id` + `description` are advertised
 * to the model up front (via the system-prompt catalog); the full `instructions` body is
 * loaded into context lazily through the `load_skill` tool, keeping the base prompt lean.
 */
export interface TraceySkill {
  /** Stable machine id used by `load_skill` and the catalog (kebab-case). */
  id: string;
  /** Short human title. */
  name: string;
  /** One-line summary shown in the system-prompt skill catalog. Keep it to a sentence. */
  description: string;
  /** The full markdown playbook injected into context when the skill is loaded. */
  instructions: string;
}
