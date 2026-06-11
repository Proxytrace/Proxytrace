import type { StepResult, ToolSet, UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  activeToolNamesFor,
  allDisclosableToolNames,
  CORE_TOOL_NAMES,
} from './tool-access';
import { loadedSkillIds, pendingAwaitables, skillIdsFromMessages, windowMessages } from './tracey-runtime';
import { createTraceyTools, type TraceyToolContext } from './tracey-tools';

const ctx: TraceyToolContext = {
  projectId: 'p1',
  artifactScope: 'u:p1',
  navigate: () => {},
  confirm: async () => true,
  loadedSkillIds: new Set<string>(),
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

describe('pendingAwaitables', () => {
  function step(parts: { toolCalls?: unknown[]; toolResults?: unknown[] }): StepResult<ToolSet> {
    return { toolCalls: parts.toolCalls ?? [], toolResults: parts.toolResults ?? [] } as unknown as StepResult<ToolSet>;
  }
  const storedRunResult = (id: string) => ({
    toolName: 'start_test_run',
    output: { artifactRef: 'ref', kind: 'test-run-group', summary: { id, awaitable: { kind: 'test-run', id } } },
  });

  it('reports a started run whose handle has not been awaited', () => {
    const steps = [step({ toolResults: [storedRunResult('g1')] })];
    expect(pendingAwaitables(steps)).toEqual([{ kind: 'test-run', id: 'g1' }]);
  });

  it('reads an inline (store-unavailable) awaitable too', () => {
    const steps = [step({ toolResults: [{ toolName: 'submit_optimization_theory', output: { id: 't1', awaitable: { kind: 'theory', id: 't1' } } }] })];
    expect(pendingAwaitables(steps)).toEqual([{ kind: 'theory', id: 't1' }]);
  });

  it('clears a handle once an await_actions call covers it', () => {
    const steps = [
      step({ toolResults: [storedRunResult('g1')] }),
      step({ toolCalls: [{ toolName: 'await_actions', input: { handles: [{ kind: 'test-run', id: 'g1' }] } }] }),
    ];
    expect(pendingAwaitables(steps)).toEqual([]);
  });

  it('keeps a second handle pending when only the first was awaited', () => {
    const steps = [
      step({ toolResults: [storedRunResult('g1'), storedRunResult('g2')] }),
      step({ toolCalls: [{ toolName: 'await_actions', input: { handles: [{ kind: 'test-run', id: 'g1' }] } }] }),
    ];
    expect(pendingAwaitables(steps)).toEqual([{ kind: 'test-run', id: 'g2' }]);
  });

  it('ignores results without a handle (cancelled, notFound, reads) and malformed await input', () => {
    const steps = [
      step({
        toolResults: [
          { toolName: 'start_test_run', output: { cancelled: true } },
          { toolName: 'start_test_run', output: { notFound: 's1' } },
          { toolName: 'get_run', output: { artifactRef: 'r', kind: 'run', summary: { id: 'r1' } } },
        ],
        toolCalls: [{ toolName: 'await_actions', input: { handles: 'oops' } }],
      }),
    ];
    expect(pendingAwaitables(steps)).toEqual([]);
  });

  it('returns nothing before any step has run', () => {
    expect(pendingAwaitables([])).toEqual([]);
  });
});

describe('skillIdsFromMessages', () => {
  function messageWith(parts: unknown[]): UIMessage {
    return { id: 'm1', role: 'assistant', parts } as unknown as UIMessage;
  }

  it('collects skill ids from load_skill tool parts across the conversation', () => {
    const messages = [
      messageWith([{ type: 'text', text: 'hi' }]),
      messageWith([
        { type: 'tool-load_skill', input: { skillId: 'optimize-agent' }, output: { name: 'optimize-agent', instructions: '…' } },
        { type: 'tool-list_agents', input: {}, output: {} },
      ]),
    ];
    expect(skillIdsFromMessages(messages)).toEqual(['optimize-agent']);
  });

  it('skips notFound results and malformed inputs', () => {
    const messages = [
      messageWith([
        { type: 'tool-load_skill', input: { skillId: 'nope' }, output: { notFound: 'nope', available: [] } },
        { type: 'tool-load_skill', input: { notSkillId: 1 } },
      ]),
    ];
    expect(skillIdsFromMessages(messages)).toEqual([]);
  });

  it('counts a streamed call whose output has not arrived yet', () => {
    const messages = [
      messageWith([{ type: 'tool-load_skill', input: { skillId: 'review-proposals' } }]),
    ];
    expect(skillIdsFromMessages(messages)).toEqual(['review-proposals']);
  });
});

describe('windowMessages', () => {
  function msg(id: number, role: 'user' | 'assistant'): UIMessage {
    return { id: String(id), role, parts: [] } as unknown as UIMessage;
  }
  /** Alternating user/assistant thread of `n` messages, starting with a user message. */
  function thread(n: number): UIMessage[] {
    return Array.from({ length: n }, (_, i) => msg(i, i % 2 === 0 ? 'user' : 'assistant'));
  }

  it('passes a short conversation through untouched', () => {
    const messages = thread(6);
    expect(windowMessages(messages, 10)).toBe(messages);
  });

  it('trims to the window, opening on a user message', () => {
    const messages = thread(20);
    const windowed = windowMessages(messages, 5);
    expect(windowed.length).toBeLessThanOrEqual(5);
    expect(windowed[0].role).toBe('user');
    expect(windowed[windowed.length - 1]).toBe(messages[19]);
  });

  it('extends past an assistant message at the cut point', () => {
    // Window of 4 over 10 alternating messages would open on assistant (index 6 is user, 7 assistant…)
    const messages = thread(10);
    const windowed = windowMessages(messages, 3);
    expect(windowed[0].role).toBe('user');
  });

  it('falls back to a plain slice when the tail has no user message', () => {
    const messages = Array.from({ length: 10 }, (_, i) => msg(i, 'assistant'));
    expect(windowMessages(messages, 4)).toHaveLength(4);
  });
});
