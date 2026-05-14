using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.Tools;

namespace Trsr.Application.Demo.Scenarios;

internal sealed class OptimizationProposalSeedScenario : IDemoScenario
{
    private readonly DemoSeedContext ctx;
    private readonly IModelSwitchProposal.CreateNew createModelSwitch;
    private readonly ISystemPromptProposal.CreateNew createSystemPrompt;
    private readonly IToolUpdateProposal.CreateNew createToolUpdate;
    private readonly IModelSwitchProposal.CreateExisting modelSwitchExisting;
    private readonly ISystemPromptProposal.CreateExisting systemPromptExisting;
    private readonly IToolUpdateProposal.CreateExisting toolUpdateExisting;
    private readonly IRepository<IOptimizationProposal> repo;

    public OptimizationProposalSeedScenario(
        DemoSeedContext ctx,
        IModelSwitchProposal.CreateNew createModelSwitch,
        ISystemPromptProposal.CreateNew createSystemPrompt,
        IToolUpdateProposal.CreateNew createToolUpdate,
        IModelSwitchProposal.CreateExisting modelSwitchExisting,
        ISystemPromptProposal.CreateExisting systemPromptExisting,
        IToolUpdateProposal.CreateExisting toolUpdateExisting,
        IRepository<IOptimizationProposal> repo)
    {
        this.ctx = ctx;
        this.createModelSwitch = createModelSwitch;
        this.createSystemPrompt = createSystemPrompt;
        this.createToolUpdate = createToolUpdate;
        this.modelSwitchExisting = modelSwitchExisting;
        this.systemPromptExisting = systemPromptExisting;
        this.toolUpdateExisting = toolUpdateExisting;
        this.repo = repo;
    }

    public int Order => 40;

    private sealed record ProposalSpec(
        Func<DemoSeedContext, IAgent> SelectAgent,
        ProposalStatus Status,
        Func<DemoSeedContext, IAgent, IReadOnlyCollection<Guid>, ITestRun, IOptimizationProposal> BuildDraft);

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var specs = new ProposalSpec[]
        {
            new(
                SelectAgent: c => c.RequireCustomerSupportAgent(),
                Status: ProposalStatus.Draft,
                BuildDraft: (c, agent, evidence, ab) => createModelSwitch(
                    agent,
                    Priority.High,
                    "Claude consistently outperforms gpt-4o on the tone suite (+17 percentage points pass rate). "
                    + "Latency increase is negligible and per-call cost stays within budget.",
                    c.RequireClaudeEndpoint(),
                    0.17,
                    0.0001m,
                    TimeSpan.FromMilliseconds(50),
                    evidence,
                    ab)),

            new(
                SelectAgent: c => c.RequireCustomerSupportAgent(),
                Status: ProposalStatus.Accepted,
                BuildDraft: (_, agent, evidence, ab) => createSystemPrompt(
                    agent,
                    Priority.Medium,
                    "Adding explicit empathy guidance to the system prompt raised pass rate from 50 % to 67 % "
                    + "between the first two runs of the tone suite.",
                    "You are a friendly, concise customer-support agent for an e-commerce store. "
                    + "Open with an empathetic acknowledgement of the customer's situation. "
                    + "Propose a clear next step, and close politely. Never blame the customer.",
                    evidence,
                    ab)),

            new(
                SelectAgent: c => c.RequireCodeReviewAgent(),
                Status: ProposalStatus.Draft,
                BuildDraft: (_, agent, evidence, ab) => createToolUpdate(
                    agent,
                    Priority.High,
                    "Adding a `lookup_symbol` tool would let the reviewer cite definitions instead of guessing "
                    + "when reviewing diffs that reference unfamiliar identifiers.",
                    [
                        new ToolSpecification(
                            name: "lookup_symbol",
                            description: "Look up the definition of a symbol (function, class, constant) in the repository.",
                            arguments: ToolArguments.None),
                    ],
                    evidence,
                    ab)),

            new(
                SelectAgent: c => c.RequireCodeReviewAgent(),
                Status: ProposalStatus.Rejected,
                BuildDraft: (_, agent, evidence, ab) => createSystemPrompt(
                    agent,
                    Priority.Low,
                    "Earlier attempt to soften review tone via prompt rewrite did not move the politeness pass rate "
                    + "(40 % both runs). Rejected in favour of a follow-up tool or fine-tune.",
                    "You are a senior software engineer reviewing pull requests. "
                    + "Be encouraging. Identify correctness, security, and clarity issues with concrete suggestions. "
                    + "Cite line numbers and offer to pair if a fix is non-trivial.",
                    evidence,
                    ab)),

            new(
                SelectAgent: c => c.RequireDataAnalyticsAgent(),
                Status: ProposalStatus.Draft,
                BuildDraft: (c, agent, evidence, ab) => createModelSwitch(
                    agent,
                    Priority.Critical,
                    "gpt-4o-mini outperformed gpt-4o on the analytics suite at roughly a fifth of the cost. "
                    + "Switching saves ~80 % of inference spend with no quality loss.",
                    c.RequireGpt4oMiniEndpoint(),
                    0.13,
                    -0.0008m,
                    TimeSpan.FromMilliseconds(-200),
                    evidence,
                    ab)),
        };

        foreach (var spec in specs)
        {
            var agent = spec.SelectAgent(ctx);
            var runsForAgent = ctx.AllRuns
                .Where(r => r.Group.Suite.Agent.Id == agent.Id)
                .ToArray();
            if (runsForAgent.Length == 0)
            {
                continue;
            }
            var evidence = runsForAgent.Take(3).Select(r => r.Id).ToArray();
            var abTestRun = runsForAgent[0];

            var draft = spec.BuildDraft(ctx, agent, evidence, abTestRun);
            var saved = await repo.AddAsync(draft, cancellationToken);

            if (spec.Status != ProposalStatus.Draft)
            {
                IOptimizationProposal transitioned = saved switch
                {
                    IModelSwitchProposal ms => modelSwitchExisting(
                        ms.Agent, spec.Status, ms.Priority, ms.Rationale,
                        ms.ProposedEndpoint, ms.ExpectedPassRateDelta, ms.ExpectedCostDelta, ms.ExpectedLatencyDelta,
                        ms.EvidenceTestRunIds, ms.ABTestRun, ms),
                    ISystemPromptProposal sp => systemPromptExisting(
                        sp.Agent, spec.Status, sp.Priority, sp.Rationale,
                        sp.ProposedSystemMessage, sp.EvidenceTestRunIds, sp.ABTestRun, sp),
                    IToolUpdateProposal tu => toolUpdateExisting(
                        tu.Agent, spec.Status, tu.Priority, tu.Rationale,
                        tu.ProposedTools, tu.EvidenceTestRunIds, tu.ABTestRun, tu),
                    _ => throw new ArgumentOutOfRangeException(nameof(saved))
                };
                await repo.UpdateAsync(transitioned, cancellationToken);
            }
        }
    }
}
