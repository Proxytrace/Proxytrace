using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Trsr.Application.Optimization.Internal;
using Trsr.Application.Optimization.Internal.Evidence;
using Trsr.Application.Statistics;
using Trsr.Application.Statistics.TestRun;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;
using Trsr.Domain.TestSuite;
using Trsr.Domain.Tools;
using Trsr.Serialization;
using Trsr.Testing;

namespace Trsr.Application.Tests;

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
        proposal.Details.Should().BeOfType<SystemPromptDetails>();
        ((SystemPromptDetails)proposal.Details).ProposedSystemMessage
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
            var proposalFactory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
            var outputFormatFactory = services.GetRequiredService<IOutputFormat.Create>();

            var agentEndpointId = Guid.NewGuid();
            var systemEndpoint = Substitute.For<IModelEndpoint>();
            systemEndpoint.Id.Returns(Guid.NewGuid());

            var agentEndpoint = Substitute.For<IModelEndpoint>();
            agentEndpoint.Id.Returns(agentEndpointId);

            var project = Substitute.For<IProject>();
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

            var suite = Substitute.For<ITestSuite>();
            suite.Agent.Returns(agent);

            var group = Substitute.For<ITestRunGroup>();
            group.Id.Returns(Guid.NewGuid());
            group.Suite.Returns(suite);

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
                    Arg.Any<Trsr.Domain.Inference.IModelParameters?>(),
                    Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IAgent>(systemAgent));

            var statistics = Substitute.For<IStatsReader<TestRunStats, TestRunStats.Filter>>();

            var optimizer = new UpdateSystemPromptOptimizer(
                proposalFactory,
                prompts,
                agents,
                new OptimizerEvidenceBuilder(),
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
