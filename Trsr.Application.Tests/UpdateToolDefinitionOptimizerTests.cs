using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Trsr.Application.Optimization.Internal;
using Trsr.Application.Optimization.Internal.Evidence;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;
using Trsr.Domain.TestSuite;
using Trsr.Domain.Tools;
using Trsr.Serialization;
using Trsr.Testing;
using TestRunStatistics = Trsr.Domain.TestRun.TestRunStatistics;

namespace Trsr.Application.Tests;

[TestClass]
public sealed class UpdateToolDefinitionOptimizerTests : BaseTest<Module>
{
    private const string OnlyToolName = "search";

    private const string ValidJsonResponse = $$"""
        {
          "tools": [
            {
              "name": "{{OnlyToolName}}",
              "description": "Refined search description.",
              "arguments": {
                "type": "object",
                "properties": {
                  "query": { "type": "string", "description": "the new query" }
                },
                "required": ["query"]
              }
            }
          ],
          "rationale": "Tightened the search description."
        }
        """;

    [TestMethod]
    public async Task DiscoverOptimizations_AgentHasNoTools_ReturnsEmpty()
    {
        OptimizerFixture fixture = BuildFixture(ValidJsonResponse, includeTool: false);
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
    public async Task DiscoverOptimizations_NoRunForCurrentEndpoint_ReturnsEmpty()
    {
        OptimizerFixture fixture = BuildFixture(ValidJsonResponse);
        ITestRun run = fixture.CreateRun(
            endpointId: Guid.NewGuid(),
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
    public async Task DiscoverOptimizations_HappyPath_ProducesToolProposal()
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
        proposal.Details.Should().BeOfType<ToolDetails>();

        var tools = ((ToolDetails)proposal.Details).ProposedTools.ToList();
        tools.Should().HaveCount(1);
        tools[0].Name.Should().Be(OnlyToolName);
        tools[0].Description.Should().Be("Refined search description.");
        tools[0].Arguments.Count.Should().Be(1);
        tools[0].Arguments[0].Name.Should().Be("query");
    }

    [TestMethod]
    public async Task DiscoverOptimizations_LlmRenamesTool_ReturnsEmpty()
    {
        const string renamedJson = """
            {
              "tools": [
                {
                  "name": "different_name",
                  "description": "...",
                  "arguments": { "type": "object", "properties": {} }
                }
              ],
              "rationale": "..."
            }
            """;
        OptimizerFixture fixture = BuildFixture(renamedJson);
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
    public async Task DiscoverOptimizations_LlmReturnsWrongToolCount_ReturnsEmpty()
    {
        const string wrongCountJson = """
            { "tools": [], "rationale": "..." }
            """;
        OptimizerFixture fixture = BuildFixture(wrongCountJson);
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

    private OptimizerFixture BuildFixture(string cannedResponse, bool includeTool = true)
    {
        IServiceProvider services = GetServices();
        return OptimizerFixture.Build(services, cannedResponse, includeTool);
    }

    private sealed class OptimizerFixture
    {
        public required UpdateToolDefinitionOptimizer Optimizer { get; init; }
        public required ITestRunGroup Group { get; init; }
        public required Guid AgentEndpointId { get; init; }

        public ITestRun CreateRun(
            Guid endpointId,
            int failed,
            int total,
            IReadOnlyList<ITestResult> results)
        {
            var endpoint = Substitute.For<IModelEndpoint>();
            endpoint.Id.Returns(endpointId);

            var run = Substitute.For<ITestRun>();
            run.Id.Returns(Guid.NewGuid());
            run.Endpoint.Returns(endpoint);
            run.TestResults.Returns(results);
            run.Group.Returns(Group);
            run.Statistics.Returns(new TestRunStatistics(
                TestCases: total,
                Passed: total - failed,
                Usage: null,
                Latency: null,
                Cost: null));
            return run;
        }

        public ITestResult CreateFailingResult()
        {
            var input = Conversation.Create();
            input.Add(new UserMessage([Content.FromText("search please")]));
            var expected = new AssistantMessage([Content.FromText("ok")], []);
            var actual = new AssistantMessage([Content.FromText("err")], []);

            var testCase = Substitute.For<ITestCase>();
            testCase.Input.Returns(input);
            testCase.ExpectedOutput.Returns(expected);

            var evaluator = Substitute.For<IEvaluator>();
            evaluator.Kind.Returns(EvaluatorKind.ExactMatch);

            var evaluation = Substitute.For<IEvaluation>();
            evaluation.Evaluator.Returns(evaluator);
            evaluation.Score.Returns(EvaluationScore.Terrible);
            evaluation.Passed.Returns(false);
            evaluation.Reasoning.Returns("tool failed");

            var result = Substitute.For<ITestResult>();
            result.Id.Returns(Guid.NewGuid());
            result.Passed.Returns(false);
            result.OverallScore.Returns(EvaluationScore.Terrible);
            result.TestCase.Returns(testCase);
            result.ActualResponse.Returns(actual);
            result.Evaluations.Returns([evaluation]);
            return result;
        }

        public static OptimizerFixture Build(IServiceProvider services, string cannedResponse, bool includeTool = true)
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

            var initialTools = includeTool
                ? new List<ToolSpecification>
                {
                    new(OnlyToolName, "Original description.", ToolArguments.None),
                }
                : new List<ToolSpecification>();

            var agent = Substitute.For<IAgent>();
            agent.Id.Returns(Guid.NewGuid());
            agent.Name.Returns("Test Agent");
            agent.Endpoint.Returns(agentEndpoint);
            agent.Project.Returns(project);
            agent.SystemPrompt.Returns(systemPrompt);
            agent.Tools.Returns(initialTools);

            var suite = Substitute.For<ITestSuite>();
            suite.Agent.Returns(agent);

            var group = Substitute.For<ITestRunGroup>();
            group.Id.Returns(Guid.NewGuid());
            group.Suite.Returns(suite);

            var systemAgent = new CannedJsonAgent(cannedResponse, outputFormatFactory);

            var prompts = Substitute.For<IPromptTemplateRepository>();
            prompts.GetAsync(UpdateToolDefinitionOptimizer.PromptName, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(systemPrompt));

            var agents = Substitute.For<IAgentRepository>();
            agents.GetOrCreateAsync(
                    Arg.Any<IPromptTemplate>(),
                    Arg.Any<IReadOnlyList<ToolSpecification>>(),
                    Arg.Any<IProject>(),
                    Arg.Any<IModelEndpoint>(),
                    Arg.Any<string?>(),
                    Arg.Any<bool>(),
                    Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IAgent>(systemAgent));

            var optimizer = new UpdateToolDefinitionOptimizer(
                proposalFactory,
                prompts,
                agents,
                new OptimizerEvidenceBuilder(),
                NullLogger<UpdateToolDefinitionOptimizer>.Instance);

            return new OptimizerFixture
            {
                Optimizer = optimizer,
                Group = group,
                AgentEndpointId = agentEndpointId,
            };
        }
    }
}
