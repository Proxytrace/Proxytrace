import { describe, it, expect } from 'vitest';
import type { StepResult, ToolSet } from 'ai';
import { pendingAwaitables, type AwaitableHandle } from './tracey-runtime';

// pendingAwaitables only reads `toolResults[].output` and `toolCalls[].{toolName,input}` off each
// step, so we build minimal step shapes and cast — no need for a full StepResult.
type MinimalStep = {
  toolResults: { output: unknown }[];
  toolCalls: { toolName: string; input: unknown }[];
};

const step = (
  results: unknown[],
  calls: { toolName: string; input: unknown }[] = [],
): StepResult<ToolSet> =>
  ({ toolResults: results.map((output) => ({ output })), toolCalls: calls } as MinimalStep as unknown as StepResult<ToolSet>);

const awaitCall = (handles: unknown): { toolName: string; input: unknown } => ({
  toolName: 'await_actions',
  input: { handles },
});

const runHandle = (id: string): AwaitableHandle => ({ kind: 'test-run', id });
const theoryHandle = (id: string): AwaitableHandle => ({ kind: 'theory', id });

describe('pendingAwaitables', () => {
  it('flags a produced handle that no await_actions call has covered', () => {
    const steps = [step([{ awaitable: runHandle('g1') }])];
    expect(pendingAwaitables(steps)).toEqual([runHandle('g1')]);
  });

  it('reads the handle whether inline (output.awaitable) or stored (output.summary.awaitable)', () => {
    const steps = [
      step([{ awaitable: runHandle('inline') }, { summary: { awaitable: theoryHandle('stored') } }]),
    ];
    expect(pendingAwaitables(steps)).toEqual([runHandle('inline'), theoryHandle('stored')]);
  });

  it('clears a handle once an await_actions call waits on it', () => {
    const steps = [
      step([{ awaitable: runHandle('g1') }]),
      step([], [awaitCall([{ kind: 'test-run', id: 'g1' }])]),
    ];
    expect(pendingAwaitables(steps)).toEqual([]);
  });

  it('keeps a handle pending when the await call passes the wrong id', () => {
    const steps = [
      step([{ awaitable: runHandle('g1') }]),
      step([], [awaitCall([{ kind: 'test-run', id: 'wrong' }])]),
    ];
    expect(pendingAwaitables(steps)).toEqual([runHandle('g1')]);
  });

  it('does not clear a handle when the await call matches the id but a different kind', () => {
    // A test-run and a theory could (pathologically) share an id; the await must match on kind too.
    const steps = [
      step([{ awaitable: runHandle('shared') }]),
      step([], [awaitCall([{ kind: 'theory', id: 'shared' }])]),
    ];
    expect(pendingAwaitables(steps)).toEqual([runHandle('shared')]);
  });

  it('returns only the uncovered handles in a partially-awaited batch', () => {
    const steps = [
      step([{ awaitable: runHandle('g1') }, { awaitable: theoryHandle('t1') }]),
      step([], [awaitCall([{ kind: 'test-run', id: 'g1' }])]),
    ];
    expect(pendingAwaitables(steps)).toEqual([theoryHandle('t1')]);
  });

  it('ignores outputs with no awaitable (cancelled / not-found writes, reads, await results)', () => {
    const steps = [
      step([{ id: 'g1', status: 'Pending' }, { cancelled: true }, { results: [], anyTimedOut: false }, null, 42]),
    ];
    expect(pendingAwaitables(steps)).toEqual([]);
  });

  it('ignores malformed handles in an await_actions call (missing/non-string fields)', () => {
    const steps = [
      step([{ awaitable: runHandle('g1') }]),
      step([], [awaitCall([{ kind: 'test-run' }, { id: 'g1' }, { kind: 'test-run', id: 7 }, null])]),
    ];
    // None of the malformed entries cover g1, so it stays pending.
    expect(pendingAwaitables(steps)).toEqual([runHandle('g1')]);
  });

  it('ignores an await_actions call whose handles arg is not an array', () => {
    const steps = [
      step([{ awaitable: runHandle('g1') }]),
      step([], [awaitCall(undefined)]),
    ];
    expect(pendingAwaitables(steps)).toEqual([runHandle('g1')]);
  });

  it('treats a handle with a non-string kind/id in the result output as absent', () => {
    const steps = [step([{ awaitable: { kind: 'test-run', id: 123 } }, { awaitable: { id: 'g1' } }])];
    expect(pendingAwaitables(steps)).toEqual([]);
  });

  it('returns nothing for an empty turn', () => {
    expect(pendingAwaitables([])).toEqual([]);
  });
});
