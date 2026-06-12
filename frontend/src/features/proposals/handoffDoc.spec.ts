import { describe, expect, it } from 'vitest';
import type { OptimizationProposalDto } from '../../api/models';
import { Priority, ProposalKind, ProposalStatus, TestRunStatus } from '../../api/models';
import { buildHandoffMarkdown, proposedClipboardPayload } from './handoffDoc';

function makeProposal(overrides: Partial<OptimizationProposalDto> = {}): OptimizationProposalDto {
  return {
    id: 'prop-12345678',
    kind: ProposalKind.SystemPrompt,
    status: ProposalStatus.Accepted,
    agentId: 'agent-1',
    agentName: 'Code Helper',
    priority: Priority.High,
    rationale: 'Adding empathy guidance raised pass rate.',
    details: {
      kind: 'SystemPrompt',
      currentSystemMessage: 'You are a bot.',
      proposedSystemMessage: 'You are an empathetic support agent.',
    },
    evidenceTestRunIds: [],
    abTestRun: null,
    currentPassRate: 0.5,
    proposedPassRate: 0.67,
    expectedPassRateDelta: 0.17,
    adoptedAt: null,
    adoptedAgentVersionId: null,
    adoptedAgentVersionNumber: null,
    adoptedManually: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('proposedClipboardPayload', () => {
  it('copies the proposed prompt verbatim for prompt proposals', () => {
    expect(proposedClipboardPayload(makeProposal())).toBe('You are an empathetic support agent.');
  });

  it('copies the proposed tools as pretty JSON for tool proposals', () => {
    const proposal = makeProposal({
      kind: ProposalKind.Tool,
      details: {
        kind: 'Tool',
        currentTools: [],
        proposedTools: [{ name: 'lookup', description: 'Look things up.', arguments: [] }],
      },
    });
    const payload = proposedClipboardPayload(proposal);
    expect(JSON.parse(payload)).toEqual([{ name: 'lookup', description: 'Look things up.', arguments: [] }]);
    expect(payload).toContain('\n');
  });

  it('copies the proposed model name for model switches', () => {
    const proposal = makeProposal({
      kind: ProposalKind.ModelSwitch,
      details: {
        kind: 'ModelSwitch',
        endpointId: 'ep-2',
        currentModelName: 'gpt-4o',
        proposedModelName: 'claude-fable-5',
        expectedCostDelta: null,
        expectedLatencyMs: null,
      },
    });
    expect(proposedClipboardPayload(proposal)).toBe('claude-fable-5');
  });
});

describe('buildHandoffMarkdown', () => {
  it('contains the agent, rationale, verbatim proposed prompt, and evidence numbers', () => {
    const md = buildHandoffMarkdown(makeProposal());
    expect(md).toContain('# Apply optimization proposal — Code Helper');
    expect(md).toContain('Adding empathy guidance raised pass rate.');
    expect(md).toContain('You are an empathetic support agent.');
    expect(md).toContain('You are a bot.');
    expect(md).toContain('Baseline pass rate: 50%');
    expect(md).toContain('Pass rate with this change: 67% (+17pt)');
  });

  it('recommends the attribution header for adoption auto-detection', () => {
    expect(buildHandoffMarkdown(makeProposal())).toContain('X-Proxytrace-Agent');
  });

  it('describes a model switch as current → proposed', () => {
    const md = buildHandoffMarkdown(makeProposal({
      kind: ProposalKind.ModelSwitch,
      details: {
        kind: 'ModelSwitch',
        endpointId: 'ep-2',
        currentModelName: 'gpt-4o',
        proposedModelName: 'gpt-4o-mini',
        expectedCostDelta: null,
        expectedLatencyMs: null,
      },
    }));
    expect(md).toContain('from `gpt-4o` to `gpt-4o-mini`');
  });

  it('links the A/B run when present', () => {
    const md = buildHandoffMarkdown(makeProposal({
      abTestRun: {
        id: 'run-9', groupId: 'g', status: TestRunStatus.Completed,
        totalCases: 1, completedCases: 1, passedCases: 1, failedCases: 0,
        passRate: 100, startedAt: '', completedAt: null, durationMs: null,
      },
    }));
    expect(md).toContain('/runs?run=run-9');
  });
});
