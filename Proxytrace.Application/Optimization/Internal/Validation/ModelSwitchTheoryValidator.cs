using JetBrains.Annotations;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Application.Optimization.Internal.Validation;

/// <summary>
/// Validates a model-switch theory by comparing the agent on its current endpoint against
/// the proposed endpoint. Reuses the evidence runs from the originating group when present,
/// otherwise executes the runs. The switch is accepted only when the proposed endpoint does
/// not regress pass rate AND delivers a real cost or latency win.
/// </summary>
[UsedImplicitly]
internal sealed class ModelSwitchTheoryValidator : TheoryValidatorBase
{
    private readonly IModelSwitchProposal.CreateNew proposalFactory;

    public ModelSwitchTheoryValidator(
        IModelSwitchProposal.CreateNew proposalFactory,
        Lazy<ITestRunnerService> testRunnerService,
        ITestRunRepository testRuns)
        : base(testRunnerService, testRuns)
    {
        this.proposalFactory = proposalFactory;
    }

    public override bool CanValidate(IOptimizationTheory theory) => theory is IModelSwitchTheory;

    public override async Task<IOptimizationProposal?> ValidateAsync(
        IOptimizationTheory theory,
        CancellationToken cancellationToken = default)
    {
        var modelSwitchTheory = (IModelSwitchTheory)theory;
        var agent = theory.Agent;

        ITestRun baselineRun = await ResolveRunAsync(theory, agent, agent.Endpoint, cancellationToken);
        ITestRun candidateRun = await ResolveRunAsync(theory, agent, modelSwitchTheory.ProposedEndpoint, cancellationToken);

        RunMetrics baseline = Metrics(baselineRun);
        RunMetrics candidate = Metrics(candidateRun);

        // Pass-rate must not regress.
        if (baseline.PassRate is not { } basePassRate
            || candidate.PassRate is not { } candidatePassRate
            || candidatePassRate < basePassRate)
        {
            return null;
        }

        decimal? costDelta = candidate.Cost.HasValue && baseline.Cost.HasValue
            ? candidate.Cost.Value - baseline.Cost.Value
            : null;
        TimeSpan latencyDelta = candidate.Latency - baseline.Latency;

        // The switch must actually save money or time — equal-quality-but-pricier is not a win.
        bool cheaper = costDelta is < 0m;
        bool faster = latencyDelta < TimeSpan.Zero;
        if (!cheaper && !faster)
        {
            return null;
        }

        return proposalFactory(
            agent: agent,
            priority: theory.Priority,
            rationale: theory.Rationale,
            proposedEndpoint: modelSwitchTheory.ProposedEndpoint,
            currentPassRate: basePassRate,
            proposedPassRate: candidatePassRate,
            expectedCostDelta: costDelta,
            expectedLatencyDelta: latencyDelta,
            evidenceTestRunIds: theory.EvidenceTestRunIds,
            abTestRun: candidateRun);
    }
}
