using Proxytrace.Application.TestRun;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Application.Optimization.Internal.Validation;

/// <summary>
/// Validates theories whose change is expressed as an <em>ephemeral agent</em> tested on the
/// agent's own endpoint (system-prompt and tool updates). It owns the common A/B flow —
/// resolve a baseline, run the candidate, gate on a pass-rate improvement — and leaves the
/// kind-specific bits (how the candidate agent is built and which proposal is produced) to
/// the subclass.
/// </summary>
internal abstract class AbTestTheoryValidator<TTheory> : TheoryValidatorBase
    where TTheory : class, IOptimizationTheory
{
    protected AbTestTheoryValidator(Lazy<ITestRunnerService> testRunnerService, ITestRunRepository testRuns)
        : base(testRunnerService, testRuns)
    {
    }

    public sealed override bool CanValidate(IOptimizationTheory theory) => theory is TTheory;

    public sealed override async Task<IOptimizationProposal?> ValidateAsync(
        IOptimizationTheory theory,
        CancellationToken cancellationToken = default)
    {
        var typedTheory = (TTheory)theory;
        var agent = theory.Agent;

        // Run the baseline and candidate fresh, back to back, against the same suite and the
        // agent's current state — so the only difference between them is the proposed change.
        // Reusing an older evidence run as the baseline would conflate the change's effect with
        // any drift in the agent since that run, especially when a theory waits in the queue.
        ITestRun baselineRun = await RunAsync(theory.Suite, agent, agent.Endpoint, cancellationToken);
        IAgent candidateAgent = BuildCandidateAgent(agent, typedTheory);
        ITestRun candidateRun = await RunAsync(theory.Suite, candidateAgent, agent.Endpoint, cancellationToken);

        RunMetrics baseline = Metrics(baselineRun);
        RunMetrics candidate = Metrics(candidateRun);

        if (baseline.PassRate is not { } basePassRate
            || candidate.PassRate is not { } candidatePassRate
            || candidatePassRate <= basePassRate)
        {
            return null;
        }

        return BuildProposal(typedTheory, basePassRate, candidatePassRate, candidateRun);
    }

    /// <summary>Builds the ephemeral agent carrying the proposed change.</summary>
    protected abstract IAgent BuildCandidateAgent(IAgent agent, TTheory theory);

    /// <summary>Builds the Draft proposal once the change has been shown to improve the agent.</summary>
    protected abstract IOptimizationProposal BuildProposal(
        TTheory theory,
        double currentPassRate,
        double proposedPassRate,
        ITestRun candidateRun);
}
