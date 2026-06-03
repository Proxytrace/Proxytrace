import type { StepResult, ToolSet } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  activeToolNamesFor,
  allDisclosableToolNames,
  CORE_TOOL_NAMES,
} from './tool-access';
import { loadedSkillIds } from './tracey-runtime';
import { createTraceyTools, type TraceyToolContext } from './tracey-tools';

const ctx: TraceyToolContext = {
  projectId: 'p1',
  navigate: () => {},
  confirm: async () => true,
};

describe('tracey tool access', () => {
  it('activates only the core set when no skill is loaded', () => {
    expect(new Set(activeToolNamesFor([]))).toEqual(new Set(CORE_TOOL_NAMES));
  });

  it('unlocks a skill bundle once its skill is loaded', () => {
    const active = activeToolNamesFor(['optimize-agent']);
    expect(active).toContain('submit_optimization_theory');
    expect(active).toContain('get_agent_stats');
    // Core stays active alongside the bundle.
    expect(active).toContain('navigate');
  });

  it('ignores unknown skill ids', () => {
    expect(new Set(activeToolNamesFor(['does-not-exist']))).toEqual(new Set(CORE_TOOL_NAMES));
  });

  it('de-duplicates tool names', () => {
    const active = activeToolNamesFor(['optimize-agent', 'optimize-agent']);
    expect(active.length).toBe(new Set(active).size);
  });

  it('keeps every defined tool reachable — core or in some skill bundle', () => {
    const disclosable = allDisclosableToolNames();
    for (const name of Object.keys(createTraceyTools(ctx))) {
      expect(disclosable.has(name)).toBe(true);
    }
  });
});

describe('loadedSkillIds', () => {
  function stepWith(toolName: string, input: unknown): StepResult<ToolSet> {
    return { toolCalls: [{ toolName, input }] } as unknown as StepResult<ToolSet>;
  }

  it('collects skill ids from load_skill calls across steps', () => {
    const steps = [
      stepWith('list_agents', {}),
      stepWith('load_skill', { skillId: 'optimize-agent' }),
    ];
    expect(loadedSkillIds(steps)).toEqual(['optimize-agent']);
  });

  it('ignores non-load_skill calls and malformed inputs', () => {
    const steps = [
      stepWith('get_agent', { agentId: 'a1' }),
      stepWith('load_skill', { notSkillId: 1 }),
    ];
    expect(loadedSkillIds(steps)).toEqual([]);
  });

  it('returns an empty list when no steps have run', () => {
    expect(loadedSkillIds([])).toEqual([]);
  });
});
