using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Exceptions;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Application.Demo.Scenarios;

/// <summary>
/// Seeds the optimization-theory pipeline so the proposals board shows hypotheses spread across
/// every lifecycle column. Validated theories link to the Draft proposals seeded just before
/// (Order 40) so the board's "Promote" action has a real target.
/// </summary>
internal sealed class OptimizationTheorySeedScenario : IDemoScenario
{
    private readonly DemoSeedContext ctx;
    private readonly ISystemPromptTheory.CreateNew createSystemPrompt;
    private readonly IModelSwitchTheory.CreateNew createModelSwitch;
    private readonly IToolUpdateTheory.CreateNew createToolUpdate;
    private readonly IRepository<IOptimizationTheory> repo;
    private readonly IOptimizationProposalRepository proposals;

    public OptimizationTheorySeedScenario(
        DemoSeedContext ctx,
        ISystemPromptTheory.CreateNew createSystemPrompt,
        IModelSwitchTheory.CreateNew createModelSwitch,
        IToolUpdateTheory.CreateNew createToolUpdate,
        IRepository<IOptimizationTheory> repo,
        IOptimizationProposalRepository proposals)
    {
        this.ctx = ctx;
        this.createSystemPrompt = createSystemPrompt;
        this.createModelSwitch = createModelSwitch;
        this.createToolUpdate = createToolUpdate;
        this.repo = repo;
        this.proposals = proposals;
    }

    // After OptimizationProposalSeedScenario (40) so validated theories can reference a proposal.
    public int Order => 45;

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var support = ctx.RequireCustomerSupportAgent();
        var codeReview = ctx.RequireCodeReviewAgent();
        var analytics = ctx.RequireDataAnalyticsAgent();

        // ── Proposed: hypotheses awaiting a test ──────────────────────────────────────────
        await SeedAsync(createModelSwitch(
            support, SuiteFor(support), TheorySource.Optimizer, Priority.High,
            "Swapping gpt-4o-mini → claude-3.5-sonnet will raise bug-localisation recall enough to justify the cost.",
            ctx.RequireClaudeEndpoint(), EvidenceFor(support)), TheoryStatus.Proposed, cancellationToken);

        await SeedAsync(createSystemPrompt(
            codeReview, SuiteFor(codeReview), TheorySource.Optimizer, Priority.Medium,
            "Adding 4 worked stack-trace examples will fix localisation without paying for a bigger model.",
            "You are a senior engineer. When localising a bug, walk the stack trace frame by frame "
            + "and cite the exact file and line before proposing a fix.",
            EvidenceFor(codeReview)), TheoryStatus.Proposed, cancellationToken);

        await SeedAsync(createSystemPrompt(
            analytics, SuiteFor(analytics), TheorySource.User, Priority.Medium,
            "Six curated few-shot examples for the edge categories will recover the misclassified long tail.",
            "You are a data analyst. Classify each row using the provided taxonomy. "
            + "Study the worked examples below before answering.",
            EvidenceFor(analytics)), TheoryStatus.Proposed, cancellationToken);

        // ── Validating: A/B test in flight ────────────────────────────────────────────────
        await SeedAsync(createToolUpdate(
            support, SuiteFor(support), TheorySource.TraceyAi, Priority.High,
            "Giving the agent a typed lookup_shipping_carrier tool will eliminate fabricated carrier tracking instructions.",
            [new ToolSpecification(
                name: "lookup_shipping_carrier",
                description: "Resolve the carrier and tracking URL for a shipment id.",
                arguments: ToolArguments.None)],
            EvidenceFor(support)), TheoryStatus.Validating, cancellationToken);

        // ── Validated: confirmed, ready to ship ───────────────────────────────────────────
        await SeedAsync(createSystemPrompt(
            support, SuiteFor(support), TheorySource.Optimizer, Priority.High,
            "Requiring an explicit order-ID confirmation step before any refund will stop the agent acting on assumed context.",
            "You are a customer-support agent. Before issuing a refund, confirm the order id with the "
            + "customer and never act on an assumed order.",
            EvidenceFor(support)),
            TheoryStatus.Validated, cancellationToken, baseline: 0.78, projected: 0.90, pValue: 0.008);

        await SeedAsync(createSystemPrompt(
            support, SuiteFor(support), TheorySource.Optimizer, Priority.Medium,
            "Tightening the priority-threshold wording will reduce mis-routed P1 tickets.",
            "You are a support triage agent. Treat outages and data loss as P1; everything else is P2 or lower. "
            + "State the priority explicitly in every reply.",
            EvidenceFor(support)),
            TheoryStatus.Validated, cancellationToken, baseline: 0.71, projected: 0.78, pValue: 0.03);

        // ── Rejected: disproven by A/B ────────────────────────────────────────────────────
        await SeedAsync(createModelSwitch(
            analytics, SuiteFor(analytics), TheorySource.Optimizer, Priority.Low,
            "Lowering temperature 0.7 → 0.2 will make repeated classifications consistent.",
            ctx.RequireGpt4oMiniEndpoint(), EvidenceFor(analytics)),
            TheoryStatus.Invalidated, cancellationToken, baseline: 0.89, projected: 0.90, pValue: 0.41);
    }

    private ITestSuite SuiteFor(IAgent agent)
    {
        var run = ctx.AllRuns.FirstOrDefault(r => r.Group.Suite.Agent.Id == agent.Id);
        return run?.Group.Suite ?? throw new InvalidOperationException($"No seeded suite for agent {agent.Name}.");
    }

    private IReadOnlyCollection<Guid> EvidenceFor(IAgent agent)
        => ctx.AllRuns
            .Where(r => r.Group.Suite.Agent.Id == agent.Id)
            .Take(3)
            .Select(r => r.Id)
            .ToArray();

    private async Task SeedAsync(
        IOptimizationTheory theory,
        TheoryStatus target,
        CancellationToken cancellationToken,
        double? baseline = null,
        double? projected = null,
        double? pValue = null)
    {
        await repo.AddAsync(theory, cancellationToken);
        if (target == TheoryStatus.Proposed)
            return;

        var proposalId = target == TheoryStatus.Validated
            ? await FindProposalIdAsync(theory.Agent.Id, theory.Kind, cancellationToken)
            : (Guid?)null;

        // Each transition is a separate persisted write; reload + retry so a transient concurrency
        // conflict (e.g. a background reader bumping the row) doesn't abort the seed. Resumable from
        // whatever state actually committed.
        const int maxAttempts = 5;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var saved = await repo.GetAsync(theory.Id, cancellationToken);
                if (saved.Status == TheoryStatus.Proposed)
                    saved = await saved.SetValidating(cancellationToken);

                if (saved.Status == TheoryStatus.Validating)
                {
                    if (target == TheoryStatus.Validated && proposalId is { } id)
                        await saved.SetValidated(id, baseline, projected, pValue, cancellationToken);
                    else if (target == TheoryStatus.Invalidated)
                        await saved.SetInvalidated(baseline, projected, pValue, cancellationToken);
                }
                return;
            }
            catch (OptimisticConcurrencyException) when (attempt < maxAttempts)
            {
                await Task.Delay(25 * attempt, cancellationToken);
            }
        }
    }

    private async Task<Guid> FindProposalIdAsync(Guid agentId, ProposalKind kind, CancellationToken cancellationToken)
    {
        var agentProposals = await proposals.GetByAgentAsync(agentId, cancellationToken);
        // Prefer a Draft proposal of the same kind so the drawer shows a coherent change for the
        // validated theory; fall back to any Draft, then any proposal.
        var match = agentProposals.FirstOrDefault(p => p.Status == ProposalStatus.Draft && p.Kind == kind)
            ?? agentProposals.FirstOrDefault(p => p.Status == ProposalStatus.Draft)
            ?? agentProposals.FirstOrDefault();
        return match?.Id ?? throw new InvalidOperationException($"No seeded proposal to back a validated theory for agent {agentId}.");
    }
}
