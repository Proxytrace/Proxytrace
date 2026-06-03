/**
 * A Tracey skill: a named, on-demand playbook authored as a `*.md` file with YAML front-matter
 * (`name` + `description`), mirroring the Claude SKILL.md convention. Only `name` + `description`
 * are advertised to the model up front (via the system-prompt catalog); the full markdown body is
 * loaded into context lazily through the `load_skill` tool, keeping the base prompt lean.
 */
export interface TraceySkill {
  /** Kebab-case identifier from the front-matter `name`. Used by `load_skill` and the catalog. */
  name: string;
  /** One-line summary from the front-matter `description`, shown in the skill catalog. */
  description: string;
  /** The markdown playbook body (everything after the front-matter), injected when loaded. */
  instructions: string;
  /**
   * Tool names this skill unlocks. These are defined but inactive until the skill is loaded; once
   * `load_skill` runs for this skill, they join the active set for the rest of the turn. Tools not
   * listed by any skill (and not in the core set) stay gated. Optional — a pure-instructions skill
   * omits it.
   */
  tools?: string[];
}
