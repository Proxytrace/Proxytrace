using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Application.Optimization.Internal;
using Proxytrace.Application.Optimization.Internal.Evidence;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Domain.Tools;
using Proxytrace.Serialization;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class UpdateSystemPromptOptimizerTests : BaseTest<Module>
{
    private const string ValidJsonResponse = """
        {
          "proposedSystemPrompt": "You are an even better assistant.",
          "rationale": "Failing cases lacked structured guidance."
        }
        """;

    [TestMethod]
    public async Task DiscoverOptimizations_NoRunForCurrentEndpoint_ReturnsEmpty()
    {
        OptimizerFixture fixture = BuildFixture(ValidJsonResponse);
        ITestRun runForOtherEndpoint = fixture.CreateRun(
            endpointId: Guid.NewGuid(),
            failed: 1,
            total: 1,
            results: []);

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group,
            [runForOtherEndpoint],
            CancellationToken);

        proposals.Should().BeEmpty();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_ZeroFailures_ReturnsEmpty()
    {
        OptimizerFixture fixture = BuildFixture(ValidJsonResponse);
        ITestRun run = fixture.CreateRun(
            endpointId: fixture.AgentEndpointId,
            failed: 0,
            total: 5,
            results: []);

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group,
            [run],
            CancellationToken);

        proposals.Should().BeEmpty();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_HappyPath_ProducesSystemPromptProposal()
    {
        OptimizerFixture fixture = BuildFixture(ValidJsonResponse);
        ITestRun run = fixture.CreateRun(
            endpointId: fixture.AgentEndpointId,
            failed: 1,
            total: 4,
            results: [fixture.CreateFailingResult()]);

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group,
            [run],
            CancellationToken);

        proposals.Should().HaveCount(1);
        IOptimizationProposal proposal = proposals[0];
        proposal.Should().BeAssignableTo<ISystemPromptProposal>();
        ((ISystemPromptProposal)proposal).ProposedSystemMessage
            .Should().Be("You are an even better assistant.");
        proposal.Rationale.Should().Contain("Failing cases lacked structured guidance.");
        proposal.EvidenceTestRunIds.Should().ContainSingle().Which.Should().Be(run.Id);
    }

    [TestMethod]
    [DataRow(1, 20, Priority.Low)]      // 5%
    [DataRow(3, 20, Priority.Medium)]   // 15%
    [DataRow(6, 20, Priority.High)]     // 30%
    [DataRow(12, 20, Priority.Critical)] // 60%
    public async Task DiscoverOptimizations_PriorityBuckets(int failed, int total, Priority expected)
    {
        OptimizerFixture fixture = BuildFixture(ValidJsonResponse);
        ITestRun run = fixture.CreateRun(
            endpointId: fixture.AgentEndpointId,
            failed: failed,
            total: total,
            results: [fixture.CreateFailingResult()]);

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group,
            [run],
            CancellationToken);

        proposals.Should().ContainSingle()
            .Which.Priority.Should().Be(expected);
    }

    [TestMethod]
    public async Task DiscoverOptimizations_MalformedJsonResponse_ReturnsEmpty()
    {
        OptimizerFixture fixture = BuildFixture(cannedResponse: "this is not JSON");
        ITestRun run = fixture.CreateRun(
            endpointId: fixture.AgentEndpointId,
            failed: 1,
            total: 1,
            results: [fixture.CreateFailingResult()]);

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group,
            [run],
            CancellationToken);

        proposals.Should().BeEmpty();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_EmptyProposedPrompt_ReturnsEmpty()
    {
        OptimizerFixture fixture = BuildFixture(
            """{ "proposedSystemPrompt": "", "rationale": "blank" }""");
        ITestRun run = fixture.CreateRun(
            endpointId: fixture.AgentEndpointId,
            failed: 1,
            total: 1,
            results: [fixture.CreateFailingResult()]);

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group,
            [run],
            CancellationToken);

        proposals.Should().BeEmpty();
    }

    private OptimizerFixture BuildFixture(string cannedResponse)
    {
        IServiceProvider services = GetServices();
        return OptimizerFixture.Build(services, cannedResponse);
    }

    private sealed class OptimizerFixture
    {
        public required UpdateSystemPromptOptimizer Optimizer { get; init; }
        public required ITestRunGroup Group { get; init; }
        public required Guid AgentEndpointId { get; init; }
        public required IStatsReader<TestRunStats, TestRunStats.Filter> Statistics { get; init; }

        public ITestRun CreateRun(
            Guid endpointId,
            int failed,
            int total,
            IReadOnlyList<ITestResult> results)
        {
            var endpoint = Substitute.For<IModelEndpoint>();
            endpoint.Id.Returns(endpointId);

            var run = Substitute.For<ITestRun>();
            Guid runId = Guid.NewGuid();
            run.Id.Returns(runId);
            run.Endpoint.Returns(endpoint);
            run.TestResults.Returns(results);
            run.Group.Returns(Group);

            Guid groupId = Group.Id;
            TestRunStats stats = new(
                TestRunId: runId,
                AgentId: Guid.Empty,
                EndpointId: endpointId,
                GroupId: groupId,
                SuiteId: Guid.Empty,
                TestCases: total,
                Passed: total - failed,
                TotalDuration: null,
                Usage: null,
                Cost: null,
                RunCompletedAt: DateTimeOffset.UtcNow);
            Statistics.FindAsync(runId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<TestRunStats?>(stats));
            return run;
        }

        public ITestResult CreateFailingResult()
        {
            var input = Conversation.Create();
            input.Add(new UserMessage([Content.FromText("ping")]));
            var expected = new AssistantMessage([Content.FromText("pong")], []);
            var actual = new AssistantMessage([Content.FromText("nope")], []);

            var testCase = Substitute.For<ITestCase>();
            testCase.Input.Returns(input);
            testCase.ExpectedOutput.Returns(expected);

            var evaluator = Substitute.For<IEvaluator>();
            evaluator.Kind.Returns(EvaluatorKind.ExactMatch);

            var evaluation = Substitute.For<IEvaluation>();
            evaluation.Evaluator.Returns(evaluator);
            evaluation.Score.Returns(EvaluationScore.Terrible);
            evaluation.Passed.Returns(false);
            evaluation.Reasoning.Returns("did not match");

            var result = Substitute.For<ITestResult>();
            result.Id.Returns(Guid.NewGuid());
            result.Passed.Returns(false);
            result.OverallScore.Returns(EvaluationScore.Terrible);
            result.TestCase.Returns(testCase);
            result.ActualResponse.Returns(actual);
            result.Evaluations.Returns([evaluation]);
            return result;
        }

        public static OptimizerFixture Build(IServiceProvider services, string cannedResponse)
        {
            var proposalFactory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();
            var outputFormatFactory = services.GetRequiredService<IOutputFormat.Create>();

            var agentEndpointId = Guid.NewGuid();
            var systemEndpoint = Substitute.For<IModelEndpoint>();
            systemEndpoint.Id.Returns(Guid.NewGuid());

            var agentEndpoint = Substitute.For<IModelEndpoint>();
            agentEndpoint.Id.Returns(agentEndpointId);

            var project = Substitute.For<IProject>();
            project.Id.Returns(Guid.NewGuid());
            project.SystemEndpoint.Returns(systemEndpoint);

            var systemPrompt = Substitute.For<IPromptTemplate>();
            systemPrompt.Template.Returns("You are an assistant.");
            systemPrompt.Variables.Returns([]);

            var agent = Substitute.For<IAgent>();
            agent.Id.Returns(Guid.NewGuid());
            agent.Name.Returns("Test Agent");
            agent.Endpoint.Returns(agentEndpoint);
            agent.Project.Returns(project);
            agent.SystemPrompt.Returns(systemPrompt);
            agent.Tools.Returns(new List<ToolSpecification>());
            agent.ModelParameters.Returns(Substitute.For<Domain.Inference.IModelParameters>());

            var suite = Substitute.For<ITestSuite>();
            suite.Agent.Returns(agent);

            var group = Substitute.For<ITestRunGroup>();
            group.Id.Returns(Guid.NewGuid());
            group.Suite.Returns(suite);

            var abTestRun = Substitute.For<ITestRun>();
            abTestRun.Id.Returns(Guid.NewGuid());
            var abGroup = Substitute.For<ITestRunGroup>();
            abGroup.GetTestRuns(Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<ITestRun>>([abTestRun]));

            var testRunnerService = Substitute.For<ITestRunnerService>();
            testRunnerService.RunInForegroundAsync(
                    Arg.Any<ITestSuite>(),
                    Arg.Any<IReadOnlyList<IModelEndpoint>>(),
                    Arg.Any<IAgent?>(),
                    Arg.Any<bool>(),
                    Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(abGroup));

            var promptTemplateFactory = services.GetRequiredService<IPromptTemplate.Create>();
            var agentFactory = services.GetRequiredService<IAgent.CreateNew>();

            var systemAgent = new CannedJsonAgent(cannedResponse, outputFormatFactory);

            var prompts = Substitute.For<IPromptTemplateRepository>();
            prompts.GetAsync(UpdateSystemPromptOptimizer.PromptName, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(systemPrompt));

            var agents = Substitute.For<IAgentRepository>();
            agents.GetOrCreateAsync(
                    Arg.Any<IPromptTemplate>(),
                    Arg.Any<IReadOnlyList<ToolSpecification>>(),
                    Arg.Any<IProject>(),
                    Arg.Any<IModelEndpoint>(),
                    Arg.Any<string?>(),
                    Arg.Any<bool>(),
                    Arg.Any<Domain.Inference.IModelParameters?>(),
                    Arg.Any<bool>(),
                    Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IAgent>(systemAgent));

            var statistics = Substitute.For<IStatsReader<TestRunStats, TestRunStats.Filter>>();

            var optimizer = new UpdateSystemPromptOptimizer(
                proposalFactory,
                prompts,
                agents,
                new OptimizerEvidenceBuilder(),
                new Lazy<ITestRunnerService>(() => testRunnerService),
                promptTemplateFactory,
                agentFactory,
                statistics);

            return new OptimizerFixture
            {
                Optimizer = optimizer,
                Group = group,
                AgentEndpointId = agentEndpointId,
                Statistics = statistics,
            };
        }
    }
}
