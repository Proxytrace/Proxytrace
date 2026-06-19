using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Application.Streaming;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Licensing;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class TestRunnerServiceTests : BaseTest<Module>
{
    private const string MatchingText = "Paris";
    private const string DifferentText = "London";


    private static async Task<ITestSuite> BuildSuiteAsync(
        IServiceProvider services,
        AssistantMessage expectedOutput,
        CancellationToken ct)
    {
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var evaluatorGenerator = services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>();
        var createTestCase = services.GetRequiredService<ITestCase.CreateNew>();
        var testCaseRepo = services.GetRequiredService<IRepository<ITestCase>>();
        var createTestSuite = services.GetRequiredService<ITestSuite.CreateNew>();
        var testSuiteRepo = services.GetRequiredService<IRepository<ITestSuite>>();

        var agent = await agentGenerator.GetOrCreateAsync(ct);
        var evaluator = await evaluatorGenerator.GetOrCreateAsync(ct);

        var input = Conversation.Create();
        input.Add(new UserMessage([Content.FromText("What is the capital of France?")]));

        var testCase = createTestCase(input, expectedOutput);
        await testCaseRepo.AddAsync(testCase, ct);

        var suite = createTestSuite("Test Suite", agent, [evaluator], [testCase]);
        await testSuiteRepo.AddAsync(suite, ct);
        return suite;
    }

    /// Builds a suite carrying one Exact Match evaluator and one agentic evaluator, so a run's
    /// evaluation count reveals whether the agentic one was skipped by the license gate.
    private static async Task<ITestSuite> BuildSuiteWithAgenticAsync(
        IServiceProvider services,
        AssistantMessage expectedOutput,
        CancellationToken ct)
    {
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var exactGenerator = services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>();
        var agenticGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgenticEvaluator>>();
        var createTestCase = services.GetRequiredService<ITestCase.CreateNew>();
        var testCaseRepo = services.GetRequiredService<IRepository<ITestCase>>();
        var createTestSuite = services.GetRequiredService<ITestSuite.CreateNew>();
        var testSuiteRepo = services.GetRequiredService<IRepository<ITestSuite>>();

        var agent = await agentGenerator.GetOrCreateAsync(ct);
        var exactMatch = await exactGenerator.CreateAsync(ct);
        var agentic = await agenticGenerator.CreateAsync(ct);

        var input = Conversation.Create();
        input.Add(new UserMessage([Content.FromText("What is the capital of France?")]));

        var testCase = createTestCase(input, expectedOutput);
        await testCaseRepo.AddAsync(testCase, ct);

        var evaluators = new IEvaluator[] { exactMatch, agentic };
        var suite = createTestSuite("Agentic Suite", agent, evaluators, [testCase]);
        await testSuiteRepo.AddAsync(suite, ct);
        return suite;
    }

    private async Task<IReadOnlyList<IModelEndpoint>> CreateEndpoints(IServiceProvider services, int count)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var endpoints = new List<IModelEndpoint>();
        for (var i = 0; i < count; i++)
            endpoints.Add(await generator.CreateAsync(CancellationToken));
        return endpoints;
    }

    private static void RegisterLicense(ContainerBuilder builder, bool agenticEnabled)
    {
        var license = Substitute.For<ILicenseService>();
        license.IsFeatureEnabled(Arg.Any<LicenseFeature>()).Returns(true);
        license.IsFeatureEnabled(LicenseFeature.AgenticEvaluators).Returns(agenticEnabled);
        builder.RegisterInstance(license).As<ILicenseService>();
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    private void RegisterFakeModelClient(ContainerBuilder builder, AssistantMessage response)
    {
        builder.Register(ct =>
        {
            IModelClient handler = Substitute.For<IModelClient>();
            var completionFactory = ct.Resolve<ICompletion.Create>();
            handler.CompleteAsync(Arg.Any<Conversation>(), Arg.Any<ModelOptions>(), Arg.Any<IReadOnlyDictionary<string, string>?>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(completionFactory(response, null, TimeSpan.FromMilliseconds(1000))));
            return handler;
        });
    }

    [TestMethod]
    public async Task RunAsync_WhenResponseMatchesExpected_ProducesPassResult()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
        });

        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        var group = await runner.RunInForegroundAsync(suite, [endpoint], cancellationToken: CancellationToken);

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        IReadOnlyList<ITestRun> testRuns = await testRunRepository.GetByGroupAsync(group.Id, CancellationToken);

        testRuns.Should().HaveCount(1);
        var testRun = testRuns.First();
        testRun.TestResults.Should().HaveCount(1);
        testRun.TestResults[0].Evaluations.Should().ContainSingle()
            .Which.Score.Should().Be(EvaluationScore.Acceptable);
    }

    [TestMethod]
    public async Task RunInForeground_WithThreeEndpoints_CreatesGroupWithThreeRuns()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config => RegisterFakeModelClient(config, expectedOutput));
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);
        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoints = await CreateEndpoints(services, 3);

        var group = await runner.RunInForegroundAsync(suite, endpoints, cancellationToken: CancellationToken);

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        var runs = await testRunRepository.GetByGroupAsync(group.Id, CancellationToken);
        runs.Should().HaveCount(3);
    }

    [TestMethod]
    public async Task RunInForeground_WithMoreThanThreeEndpoints_Throws()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config => RegisterFakeModelClient(config, expectedOutput));
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);
        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoints = await CreateEndpoints(services, 4);

        await FluentActions
            .Invoking(() => runner.RunInForegroundAsync(suite, endpoints, cancellationToken: CancellationToken))
            .Should().ThrowAsync<ArgumentException>();
    }

    [TestMethod]
    public async Task RunInForeground_InvokesOnGroupCreated_WithPendingGroupBeforeExecution()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config => RegisterFakeModelClient(config, expectedOutput));

        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);
        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        TestRunStatus? statusAtCallback = null;
        Guid? observedRunId = null;

        var group = await runner.RunInForegroundAsync(
            suite,
            [endpoint],
            onGroupCreated: async (createdGroup, ct) =>
            {
                statusAtCallback = createdGroup.Status;
                var createdRuns = await createdGroup.GetTestRuns(ct);
                observedRunId = createdRuns.First().Id;
            },
            cancellationToken: CancellationToken);

        // The hook must see the group before it executes, with its run already persisted.
        statusAtCallback.Should().Be(TestRunStatus.Pending);
        observedRunId.Should().NotBeNull();

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        var runs = await testRunRepository.GetByGroupAsync(group.Id, CancellationToken);
        runs.Should().ContainSingle(r => r.Id == observedRunId);
    }

    [TestMethod]
    public async Task RunAsync_WhenResponseDiffersFromExpected_ProducesFailResult()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var actualOutput = new AssistantMessage([Content.FromText(DifferentText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, actualOutput);
        });

        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        var group = await runner.RunInForegroundAsync(suite, [endpoint], cancellationToken: CancellationToken);

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        IReadOnlyList<ITestRun> testRuns = await testRunRepository.GetByGroupAsync(group.Id, CancellationToken);

        testRuns.Should().HaveCount(1);
        var testRun = testRuns.First();
        testRun.TestResults.Should().HaveCount(1);
        testRun.TestResults[0].Evaluations.Should().ContainSingle()
            .Which.Score.Should().Be(EvaluationScore.Terrible);
    }

    [TestMethod]
    public async Task RunAsync_PassResult_IsPersistedToRepository()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
        });
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var resultRepo = services.GetRequiredService<IRepository<ITestResult>>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        var group = await runner.RunInForegroundAsync(suite, [endpoint], cancellationToken: CancellationToken);

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        IReadOnlyList<ITestRun> testRuns = await testRunRepository.GetByGroupAsync(group.Id, CancellationToken);
        var testRun = testRuns.First();

        var storedResult = await resultRepo.GetAsync(testRun.TestResults[0].Id, CancellationToken);
        storedResult.Evaluations.Should().ContainSingle()
            .Which.Score.Should().Be(EvaluationScore.Acceptable);
        storedResult.ActualResponse.Should().Be(testRun.TestResults[0].ActualResponse);
    }

    [TestMethod]
    public async Task RunAsync_FailResult_IsPersistedToRepository()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var actualOutput = new AssistantMessage([Content.FromText(DifferentText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, actualOutput);
        });
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var resultRepo = services.GetRequiredService<IRepository<ITestResult>>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        var group = await runner.RunInForegroundAsync(suite, [endpoint], cancellationToken: CancellationToken);

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        IReadOnlyList<ITestRun> testRuns = await testRunRepository.GetByGroupAsync(group.Id, CancellationToken);
        var testRun = testRuns.First();

        var storedResult = await resultRepo.GetAsync(testRun.TestResults[0].Id, CancellationToken);
        storedResult.Evaluations.Should().ContainSingle()
            .Which.Score.Should().Be(EvaluationScore.Terrible);
    }

    [TestMethod]
    public async Task RunAsync_PublishesTestResultArrivedEvent_CarryingTheEvaluations()
    {
        // Regression: the live SSE event that completes a matrix cell must carry the case's
        // evaluations, not just its latency. Previously the runner built the event from the
        // result object it created with an empty evaluation list (the evaluations were added
        // to reloaded copies), so cells finished with no evaluator dots until the final refetch.
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var broadcaster = Substitute.For<ITestResultBroadcaster>();
        var published = new List<TestRunEvent>();
        broadcaster.When(b => b.Publish(Arg.Any<TestRunEvent>()))
            .Do(ci => published.Add(ci.Arg<TestRunEvent>()));

        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
            config.RegisterInstance(broadcaster).As<ITestResultBroadcaster>();
        });

        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);
        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        await runner.RunInForegroundAsync(suite, [endpoint], cancellationToken: CancellationToken);

        var resultArrived = published.OfType<TestResultArrivedEvent>().Should().ContainSingle().Subject;
        resultArrived.Evaluations.Should().ContainSingle()
            .Which.Score.Should().Be(EvaluationScore.Acceptable);
    }

    [TestMethod]
    public async Task RunAsync_TestRun_IsPersistedToRepository()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
        });
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var runRepo = services.GetRequiredService<IRepository<ITestRun>>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        var group = await runner.RunInForegroundAsync(suite, [endpoint], cancellationToken: CancellationToken);

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        IReadOnlyList<ITestRun> testRuns = await testRunRepository.GetByGroupAsync(group.Id, CancellationToken);
        var testRun = testRuns.First();

        var storedRun = await runRepo.GetAsync(testRun.Id, CancellationToken);
        storedRun.Should().NotBeNull();
        storedRun.TestResults.Should().HaveCount(1);
    }

    [TestMethod]
    public async Task RunAsync_WhenAgenticEvaluatorsDisabled_SkipsAgenticEvaluator()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
            RegisterLicense(config, agenticEnabled: false);
        });

        var suite = await BuildSuiteWithAgenticAsync(services, expectedOutput, CancellationToken);
        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        var group = await runner.RunInForegroundAsync(suite, [endpoint], cancellationToken: CancellationToken);

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        var testRun = (await testRunRepository.GetByGroupAsync(group.Id, CancellationToken)).First();

        // Only the Exact Match evaluator runs; the agentic one is skipped (not errored).
        testRun.TestResults[0].Evaluations.Should().ContainSingle()
            .Which.Evaluator.Kind.Should().Be(EvaluatorKind.ExactMatch);
    }

    [TestMethod]
    public async Task RunAsync_WhenAgenticEvaluatorsEnabled_RunsAgenticEvaluator()
    {
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
            RegisterLicense(config, agenticEnabled: true);
        });

        var suite = await BuildSuiteWithAgenticAsync(services, expectedOutput, CancellationToken);
        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        var group = await runner.RunInForegroundAsync(suite, [endpoint], cancellationToken: CancellationToken);

        var testRunRepository = services.GetRequiredService<ITestRunRepository>();
        var testRun = (await testRunRepository.GetByGroupAsync(group.Id, CancellationToken)).First();

        // Both evaluators run: Exact Match and the agentic one.
        testRun.TestResults[0].Evaluations.Should().HaveCount(2);
        testRun.TestResults[0].Evaluations.Select(e => e.Evaluator.Kind)
            .Should().Contain(EvaluatorKind.Agentic);
    }
}
