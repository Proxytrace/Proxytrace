using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Trsr.Application.TestRun;
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

namespace Trsr.Application.Tests;

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

        var suite = createTestSuite("Test Suite", agent, evaluator, [testCase]);
        await testSuiteRepo.AddAsync(suite, ct);
        return suite;
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    private void RegisterFakeModelClient(ContainerBuilder builder, AssistantMessage response)
    {
        IModelClient? handler = Substitute.For<IModelClient>();
        handler.CompleteAsync(Arg.Any<Conversation>(), Arg.Any<ModelOptions>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(response));
        builder.RegisterInstance(handler);
    }
    
    [TestMethod]
    public async Task RunAsync_WhenResponseMatchesExpected_ProducesPassResult()
    {
        // Arrange – fake agent returns the matching text
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
        });

        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunInForegroundAsync(suite, endpoint, CancellationToken);

        // Assert
        testRun.TestResults.Should().HaveCount(1);
        testRun.TestResults[0].Evaluation.Should().Be(Evaluation.Pass);
    }

    [TestMethod]
    public async Task RunAsync_WhenResponseDiffersFromExpected_ProducesFailResult()
    {
        // Arrange – fake agent returns text that does NOT match the expected output
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var actualOutput = new AssistantMessage([Content.FromText(DifferentText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, actualOutput);
        });
        
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunInForegroundAsync(suite, endpoint, CancellationToken);

        // Assert
        testRun.TestResults.Should().HaveCount(1);
        testRun.TestResults[0].Evaluation.Should().Be(Evaluation.Fail);
    }

    [TestMethod]
    public async Task RunAsync_PassResult_IsPersistedToRepository()
    {
        // Arrange
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
        });
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var resultRepo = services.GetRequiredService<IRepository<ITestResult>>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunInForegroundAsync(suite, endpoint, CancellationToken);

        // Assert – the result is retrievable from the repository with correct evaluation
        var storedResult = await resultRepo.GetAsync(testRun.TestResults[0].Id, CancellationToken);
        storedResult.Evaluation.Should().Be(Evaluation.Pass);
        storedResult.ActualResponse.Should().Be(testRun.TestResults[0].ActualResponse);
    }

    [TestMethod]
    public async Task RunAsync_FailResult_IsPersistedToRepository()
    {
        // Arrange
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

        // Act
        var testRun = await runner.RunInForegroundAsync(suite, endpoint, CancellationToken);

        // Assert
        var storedResult = await resultRepo.GetAsync(testRun.TestResults[0].Id, CancellationToken);
        storedResult.Evaluation.Should().Be(Evaluation.Fail);
    }

    [TestMethod]
    public async Task RunAsync_TestRun_IsPersistedToRepository()
    {
        // Arrange
        var expectedOutput = new AssistantMessage([Content.FromText(MatchingText)], []);
        var services = GetServices(config =>
        {
            RegisterFakeModelClient(config, expectedOutput);
        });
        var suite = await BuildSuiteAsync(services, expectedOutput, CancellationToken);

        var runner = services.GetRequiredService<ITestRunnerService>();
        var runRepo = services.GetRequiredService<IRepository<ITestRun>>();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync();

        // Act
        var testRun = await runner.RunInForegroundAsync(suite, endpoint, CancellationToken);

        // Assert
        var storedRun = await runRepo.GetAsync(testRun.Id, CancellationToken);
        storedRun.Should().NotBeNull();
        storedRun.TestResults.Should().HaveCount(1);
    }
}
