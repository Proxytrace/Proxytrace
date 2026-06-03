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

  it('keeps the core lean — gated reads/actions are not in it', () => {
    expect(CORE_TOOL_NAMES).not.toContain('list_proposals');
    expect(CORE_TOOL_NAMES).not.toContain('start_test_run');
    expect(CORE_TOOL_NAMES).not.toContain('get_dashboard_stats');
    // The universal agent reads and renderers stay core.
    expect(CORE_TOOL_NAMES).toContain('get_agent');
    expect(CORE_TOOL_NAMES).toContain('show_chart');
  });

  it('unlocks a skill bundle once its skill is loaded', () => {
    const active = activeToolNamesFor(['review-proposals']);
    expect(active).toContain('list_proposals');
    expect(active).toContain('set_proposal_status');
    // Core stays active alongside the bundle.
    expect(active).toContain('navigate');
    // A different skill's tools stay gated.
    expect(active).not.toContain('start_test_run');
  });

  it('unions bundles when several skills are loaded', () => {
    const active = activeToolNamesFor(['review-proposals', 'test-suites-and-runs']);
    expect(active).toContain('set_proposal_status');
    expect(active).toContain('start_test_run');
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
