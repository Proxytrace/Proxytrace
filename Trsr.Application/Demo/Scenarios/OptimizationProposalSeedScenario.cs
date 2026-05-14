using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;
using Trsr.Domain.Tools;

namespace Trsr.Application.Demo.Scenarios;

internal sealed class OptimizationProposalSeedScenario : IDemoScenario
{
    private readonly DemoSeedContext ctx;
    private readonly IOptimizationProposal.CreateNew createNew;
    private readonly IOptimizationProposal.CreateExisting createExisting;
    private readonly IRepository<IOptimizationProposal> repo;

    public OptimizationProposalSeedScenario(
        DemoSeedContext ctx,
        IOptimizationProposal.CreateNew createNew,
        IOptimizationProposal.CreateExisting createExisting,
        IRepository<IOptimizationProposal> repo)
    {
        this.ctx = ctx;
        this.createNew = createNew;
        this.createExisting = createExisting;
        this.repo = repo;
    }

    public int Order => 40;

    private sealed record ProposalSpec(
        Func<DemoSeedContext, IAgent> SelectAgent,
        Priority Priority,
        ProposalStatus Status,
        string Rationale,
        Func<DemoSeedContext, ProposalDetails> BuildDetails,
        Func<DemoSeedContext, IReadOnlyCollection<Guid>> SelectEvidence);

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var specs = new ProposalSpec[]
        {
            new(
                SelectAgent: c => c.RequireCustomerSupportAgent(),
                Priority: Priority.High,
                Status: ProposalStatus.Draft,
                Rationale: "Claude consistently outperforms gpt-4o on the tone suite (+17 percentage points pass rate). "
                           + "Latency increase is negligible and per-call cost stays within budget.",
                BuildDetails: c => new ModelSwitchDetails(
                    ProposedEndpointId: c.RequireClaudeEndpoint().Id,
                    ExpectedPassRateDelta: 0.17,
                    ExpectedCostDelta: 0.0001m,
                    ExpectedLatencyDelta: TimeSpan.FromMilliseconds(50)),
                SelectEvidence: c => EvidenceForAgent(c, c.RequireCustomerSupportAgent())),

            new(
                SelectAgent: c => c.RequireCustomerSupportAgent(),
                Priority: Priority.Medium,
                Status: ProposalStatus.Accepted,
                Rationale: "Adding explicit empathy guidance to the system prompt raised pass rate from 50 % to 67 % "
                           + "between the first two runs of the tone suite.",
                BuildDetails: _ => new SystemPromptDetails(
                    ProposedSystemMessage:
                    "You are a friendly, concise customer-support agent for an e-commerce store. "
                    + "Open with an empathetic acknowledgement of the customer's situation. "
                    + "Propose a clear next step, and close politely. Never blame the customer."),
                SelectEvidence: c => EvidenceForAgent(c, c.RequireCustomerSupportAgent())),

            new(
                SelectAgent: c => c.RequireCodeReviewAgent(),
                Priority: Priority.High,
                Status: ProposalStatus.Draft,
                Rationale: "Adding a `lookup_symbol` tool would let the reviewer cite definitions instead of guessing "
                           + "when reviewing diffs that reference unfamiliar identifiers.",
                BuildDetails: _ => new ToolDetails(
                    ProposedTools:
                    [
                        new ToolSpecification(
                            name: "lookup_symbol",
                            description: "Look up the definition of a symbol (function, class, constant) in the repository.",
                            arguments: ToolArguments.None),
                    ]),
                SelectEvidence: c => EvidenceForAgent(c, c.RequireCodeReviewAgent())),

            new(
                SelectAgent: c => c.RequireCodeReviewAgent(),
                Priority: Priority.Low,
                Status: ProposalStatus.Rejected,
                Rationale: "Earlier attempt to soften review tone via prompt rewrite did not move the politeness pass rate "
                           + "(40 % both runs). Rejected in favour of a follow-up tool or fine-tune.",
                BuildDetails: _ => new SystemPromptDetails(
                    ProposedSystemMessage:
                    "You are a senior software engineer reviewing pull requests. "
                    + "Be encouraging. Identify correctness, security, and clarity issues with concrete suggestions. "
                    + "Cite line numbers and offer to pair if a fix is non-trivial."),
                SelectEvidence: c => EvidenceForAgent(c, c.RequireCodeReviewAgent())),

            new(
                SelectAgent: c => c.RequireDataAnalyticsAgent(),
                Priority: Priority.Critical,
                Status: ProposalStatus.Draft,
                Rationale: "gpt-4o-mini outperformed gpt-4o on the analytics suite at roughly a fifth of the cost. "
                           + "Switching saves ~80 % of inference spend with no quality loss.",
                BuildDetails: c => new ModelSwitchDetails(
                    ProposedEndpointId: c.RequireGpt4oMiniEndpoint().Id,
                    ExpectedPassRateDelta: 0.13,
                    ExpectedCostDelta: -0.0008m,
                    ExpectedLatencyDelta: TimeSpan.FromMilliseconds(-200)),
                SelectEvidence: c => EvidenceForAgent(c, c.RequireDataAnalyticsAgent())),
        };

        foreach (var spec in specs)
        {
            var agent = spec.SelectAgent(ctx);
            var details = spec.BuildDetails(ctx);
            var evidence = spec.SelectEvidence(ctx);

            var draft = createNew(agent, spec.Priority, spec.Rationale, details, evidence);
            var saved = await repo.AddAsync(draft, cancellationToken);

            if (spec.Status != ProposalStatus.Draft)
            {
                var transitioned = createExisting(
                    saved.Agent,
                    spec.Status,
                    saved.Priority,
                    saved.Rationale,
                    saved.Details,
                    saved.EvidenceTestRunIds,
                    saved);
                await repo.UpdateAsync(transitioned, cancellationToken);
            }
        }
    }

    private static IReadOnlyCollection<Guid> EvidenceForAgent(DemoSeedContext ctx, IAgent agent)
        => ctx.AllRuns
            .Where(r => r.Group.Suite.Agent.Id == agent.Id)
            .Select(r => r.Id)
            .Take(3)
            .ToArray();
}
