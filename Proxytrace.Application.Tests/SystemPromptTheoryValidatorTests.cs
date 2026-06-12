using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Application.Optimization.Internal.Validation;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Domain.Tools;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class SystemPromptTheoryValidatorTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Validate_CandidateImproves_ProducesProposal()
    {
        // A large improvement over a decent sample (10/50 → 45/50) — far beyond sampling noise.
        var f = Build(baselinePassed: Passes(10, 50), candidatePassed: Passes(45, 50));

        var outcome = await f.Validator.ValidateAsync(f.Theory, CancellationToken);

        outcome.Proposal.Should().NotBeNull();
        outcome.BaselinePassRate.Should().Be(0.2);
        outcome.ProjectedPassRate.Should().Be(0.9);
        outcome.PValue.Should().BeLessThan(AbTestTheoryValidator<ISystemPromptTheory>.SignificanceLevel);
        f.Captured.CurrentPassRate.Should().Be(0.2);
        f.Captured.ProposedPassRate.Should().Be(0.9);
    }

    [TestMethod]
    public async Task Validate_ImprovementWithinNoise_ReturnsNoProposalButRecordsMetrics()
    {
        // 1/2 → 2/2 looks like an improvement but is statistically indistinguishable from a
        // single flaky case — it must not spawn a proposal.
        var f = Build(baselinePassed: [true, false], candidatePassed: [true, true]);

        var outcome = await f.Validator.ValidateAsync(f.Theory, CancellationToken);

        outcome.Proposal.Should().BeNull();
        outcome.BaselinePassRate.Should().Be(0.5);
        outcome.ProjectedPassRate.Should().Be(1.0);
        outcome.PValue.Should().BeGreaterThan(AbTestTheoryValidator<ISystemPromptTheory>.SignificanceLevel);
    }

    [TestMethod]
    public async Task Validate_CandidateNoImprovement_ReturnsNoProposalButRecordsMetrics()
    {
        var f = Build(baselinePassed: [true, true], candidatePassed: [true, true]);

        var outcome = await f.Validator.ValidateAsync(f.Theory, CancellationToken);

        outcome.Proposal.Should().BeNull();
        outcome.BaselinePassRate.Should().Be(1.0);
        outcome.ProjectedPassRate.Should().Be(1.0);
    }

    [TestMethod]
    public async Task Validate_CandidateRegresses_ReturnsNoProposal()
    {
        var f = Build(baselinePassed: [true, true], candidatePassed: [true, false]);

        var outcome = await f.Validator.ValidateAsync(f.Theory, CancellationToken);

        outcome.Proposal.Should().BeNull();
        outcome.BaselinePassRate.Should().Be(1.0);
        outcome.ProjectedPassRate.Should().Be(0.5);
    }

    [TestMethod]
    public async Task Validate_UnevaluatedResults_DoNotCountAsPass()
    {
        // A run whose results carry no evaluations must score 0, not 1 (All() over empty is vacuously true).
        var f = Build(baselinePassed: [true], candidatePassed: []); // candidate result has zero evaluations
        f.OverrideCandidate(MakeRunWithEmptyEvaluations(1));

        var outcome = await f.Validator.ValidateAsync(f.Theory, CancellationToken);

        outcome.Proposal.Should().BeNull();
    }

    private static bool[] Passes(int passed, int total)
        => Enumerable.Range(0, total).Select(i => i < passed).ToArray();

    private Fixture Build(bool[] baselinePassed, bool[] candidatePassed)
    {
        var endpoint = Substitute.For<IModelEndpoint>();
        endpoint.Id.Returns(Guid.NewGuid());

        var agent = Substitute.For<IAgent>();
        agent.Name.Returns("agent");
        agent.Endpoint.Returns(endpoint);
        agent.Tools.Returns(new List<ToolSpecification>());
        agent.Project.Returns(Substitute.For<Domain.Project.IProject>());
        agent.SystemPrompt.Returns(Substitute.For<IPromptTemplate>());
        agent.ModelParameters.Returns(Substitute.For<IModelParameters>());

        var suite = Substitute.For<ITestSuite>();

        var theory = Substitute.For<ISystemPromptTheory>();
        theory.Agent.Returns(agent);
        theory.Suite.Returns(suite);
        theory.Priority.Returns(Priority.Medium);
        theory.Rationale.Returns("better prompt");
        theory.ProposedSystemMessage.Returns("You are better.");
        theory.EvidenceTestRunIds.Returns(Array.Empty<Guid>());

        var baselineRun = MakeRun(endpoint, baselinePassed);
        var candidateRun = MakeRun(endpoint, candidatePassed);
        var baselineGroup = GroupReturning(baselineRun);
        var candidateGroup = GroupReturning(candidateRun);

        var runner = Substitute.For<ITestRunnerService>();
        runner.RunInForegroundAsync(
                Arg.Any<ITestSuite>(), Arg.Any<IReadOnlyList<IModelEndpoint>>(),
                Arg.Any<IAgent?>(), Arg.Any<bool>(),
                Arg.Any<Func<ITestRunGroup, CancellationToken, Task>?>(), Arg.Any<CancellationToken>())
            .Returns(baselineGroup, candidateGroup);

        var captured = new Captured();
        ISystemPromptProposal.CreateNew proposalFactory = (
            _, _, _, _, currentPassRate, proposedPassRate, _, _) =>
        {
            captured.CurrentPassRate = currentPassRate;
            captured.ProposedPassRate = proposedPassRate;
            return Substitute.For<ISystemPromptProposal>();
        };

        IPromptTemplate.Create promptFactory = (_, _) => Substitute.For<IPromptTemplate>();
        IAgent.CreateNew agentFactory = (_, _, _, _, _, _, _) =>
        {
            var candidate = Substitute.For<IAgent>();
            candidate.Endpoint.Returns(endpoint);
            return candidate;
        };

        var validator = new SystemPromptTheoryValidator(
            proposalFactory, promptFactory, agentFactory,
            new Lazy<ITestRunnerService>(() => runner),
            Substitute.For<ITestRunRepository>());

        return new Fixture { Validator = validator, Theory = theory, Captured = captured, Runner = runner, Endpoint = endpoint, Baseline = baselineRun };
    }

    private static ITestRunGroup GroupReturning(ITestRun run)
    {
        var group = Substitute.For<ITestRunGroup>();
        group.GetTestRuns(Arg.Any<CancellationToken>()).Returns(Task.FromResult<IReadOnlyList<ITestRun>>([run]));
        return group;
    }

    private static ITestRun MakeRun(IModelEndpoint endpoint, bool[] passed)
    {
        var results = passed.Select(p =>
        {
            var ev = Substitute.For<IEvaluation>();
            ev.Passed.Returns(p);
            var r = Substitute.For<ITestResult>();
            r.Evaluations.Returns([ev]);
            return r;
        }).ToList();

        var run = Substitute.For<ITestRun>();
        run.Id.Returns(Guid.NewGuid());
        run.Endpoint.Returns(endpoint);
        run.TestResults.Returns(results);
        return run;
    }

    private static ITestRun MakeRunWithEmptyEvaluations(int resultCount)
    {
        var results = Enumerable.Range(0, resultCount).Select(_ =>
        {
            var r = Substitute.For<ITestResult>();
            r.Evaluations.Returns(Array.Empty<IEvaluation>());
            return r;
        }).ToList();

        var run = Substitute.For<ITestRun>();
        run.Id.Returns(Guid.NewGuid());
        run.TestResults.Returns(results);
        return run;
    }

    private sealed class Fixture
    {
        public required SystemPromptTheoryValidator Validator { get; init; }
        public required ISystemPromptTheory Theory { get; init; }
        public required Captured Captured { get; init; }
        public required ITestRunnerService Runner { get; init; }
        public required IModelEndpoint Endpoint { get; init; }
        public required ITestRun Baseline { get; init; }

        public void OverrideCandidate(ITestRun candidate)
        {
            var baselineGroup = GroupReturning(Baseline);
            var candidateGroup = GroupReturning(candidate);
            Runner.RunInForegroundAsync(
                    Arg.Any<ITestSuite>(), Arg.Any<IReadOnlyList<IModelEndpoint>>(),
                    Arg.Any<IAgent?>(), Arg.Any<bool>(),
                    Arg.Any<Func<ITestRunGroup, CancellationToken, Task>?>(), Arg.Any<CancellationToken>())
                .Returns(baselineGroup, candidateGroup);
        }
    }

    private sealed class Captured
    {
        public double? CurrentPassRate { get; set; }
        public double? ProposedPassRate { get; set; }
    }
}
