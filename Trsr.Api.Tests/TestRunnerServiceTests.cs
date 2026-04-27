using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Services;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class TestRunnerServiceTests : BaseTest<Module>
{
    private const string MatchingText = "Paris";
    private const string DifferentText = "London";

    // ── helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns a service provider whose "self" HTTP client returns the given response body.
    /// </summary>
    private IServiceProvider GetServicesWithFakeAgent(string agentResponseBody)
        => GetServices(builder =>
            builder
                .Register(_ => new FakeHttpClientFactory(agentResponseBody))
                .As<IHttpClientFactory>()
                .SingleInstance());

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

        var suite = createTestSuite(agent, evaluator, [testCase]);
        await testSuiteRepo.AddAsync(suite, ct);
        return suite;
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    [TestMethod]
    public async Task RunAsync_WhenResponseMatchesExpected_ProducesPassResult()
    {
        // Arrange – fake agent returns the matching text
        var services = GetServicesWithFakeAgent(
            FakeHttpMessageHandler.BuildOpenAiResponse(MatchingText));

        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunAsync(suite, endpoint, CancellationToken);

        // Assert
        testRun.TestResults.Should().HaveCount(1);
        testRun.TestResults[0].Evaluation.Should().Be(Evaluation.Pass);
    }

    [TestMethod]
    public async Task RunAsync_WhenResponseDiffersFromExpected_ProducesFailResult()
    {
        // Arrange – fake agent returns text that does NOT match the expected output
        var services = GetServicesWithFakeAgent(
            FakeHttpMessageHandler.BuildOpenAiResponse(DifferentText));

        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunAsync(suite, endpoint, CancellationToken);

        // Assert
        testRun.TestResults.Should().HaveCount(1);
        testRun.TestResults[0].Evaluation.Should().Be(Evaluation.Fail);
    }

    [TestMethod]
    public async Task RunAsync_PassResult_IsPersistedToRepository()
    {
        // Arrange
        var services = GetServicesWithFakeAgent(
            FakeHttpMessageHandler.BuildOpenAiResponse(MatchingText));

        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var resultRepo = services.GetRequiredService<IRepository<ITestResult>>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunAsync(suite, endpoint, CancellationToken);

        // Assert – the result is retrievable from the repository with correct evaluation
        var storedResult = await resultRepo.GetAsync(testRun.TestResults[0].Id, CancellationToken);
        storedResult.Evaluation.Should().Be(Evaluation.Pass);
        storedResult.ActualResponse.Should().Be(testRun.TestResults[0].ActualResponse);
    }

    [TestMethod]
    public async Task RunAsync_FailResult_IsPersistedToRepository()
    {
        // Arrange
        var services = GetServicesWithFakeAgent(
            FakeHttpMessageHandler.BuildOpenAiResponse(DifferentText));

        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var resultRepo = services.GetRequiredService<IRepository<ITestResult>>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunAsync(suite, endpoint, CancellationToken);

        // Assert
        var storedResult = await resultRepo.GetAsync(testRun.TestResults[0].Id, CancellationToken);
        storedResult.Evaluation.Should().Be(Evaluation.Fail);
    }

    [TestMethod]
    public async Task RunAsync_TestRun_IsPersistedToRepository()
    {
        // Arrange
        var services = GetServicesWithFakeAgent(
            FakeHttpMessageHandler.BuildOpenAiResponse(MatchingText));

        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var runRepo = services.GetRequiredService<IRepository<ITestRun>>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunAsync(suite, endpoint, CancellationToken);

        // Assert
        var storedRun = await runRepo.GetAsync(testRun.Id, CancellationToken);
        storedRun.Should().NotBeNull();
        storedRun.TestResults.Should().HaveCount(1);
    }

    [TestMethod]
    public async Task RunAsync_ActualResponse_ReflectsAgentOutput()
    {
        // Arrange
        const string responseText = "The capital of France is Paris.";
        var services = GetServicesWithFakeAgent(
            FakeHttpMessageHandler.BuildOpenAiResponse(responseText));

        // Expected output does NOT match so we can observe the actual response independently
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunAsync(suite, endpoint, CancellationToken);

        // Assert – actual response contains the text the fake agent returned
        var actualText = string.Concat(
            testRun.TestResults[0].ActualResponse.Contents.Select(c => c.Text ?? ""));
        actualText.Should().Be(responseText);
    }

    [TestMethod]
    public async Task RunAsync_MultipleCases_AllEvaluatedWithExactMatch()
    {
        // Arrange – suite has two cases, both expect MatchingText; fake agent returns MatchingText
        var services = GetServicesWithFakeAgent(
            FakeHttpMessageHandler.BuildOpenAiResponse(MatchingText));

        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var evaluatorGenerator = services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>();
        var createTestCase = services.GetRequiredService<ITestCase.CreateNew>();
        var testCaseRepo = services.GetRequiredService<IRepository<ITestCase>>();
        var createTestSuite = services.GetRequiredService<ITestSuite.CreateNew>();
        var testSuiteRepo = services.GetRequiredService<IRepository<ITestSuite>>();

        var agent = await agentGenerator.GetOrCreateAsync(CancellationToken);
        var evaluator = await evaluatorGenerator.GetOrCreateAsync(CancellationToken);

        var input = Conversation.Create();
        input.Add(new UserMessage([Content.FromText("Q")]));

        var matchingExpected = new AssistantMessage([Content.FromText(MatchingText)], []);
        var case1 = createTestCase(input, matchingExpected);
        var case2 = createTestCase(input, matchingExpected);

        await testCaseRepo.AddAsync(case1, CancellationToken);
        await testCaseRepo.AddAsync(case2, CancellationToken);

        var suite = createTestSuite(agent, evaluator, [case1, case2]);
        await testSuiteRepo.AddAsync(suite, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunAsync(suite, endpoint, CancellationToken);

        // Assert – both results should pass since both expectations match
        testRun.TestResults.Should().HaveCount(2);
        testRun.TestResults.Should().AllSatisfy(r => r.Evaluation.Should().Be(Evaluation.Pass));
    }
}
