using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class TestResultValidationTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesTestResult()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var testCase = await CreateTestCaseAsync(services);
        var actualResponse = new AssistantMessage([Content.FromText("Result")], []);

        var testResult = factory(testCase, actualResponse, [], TimeSpan.FromMilliseconds(1500L));

        testResult.Should().NotBeNull();
        testResult.TestCase.Should().Be(testCase);
        testResult.ActualResponse.Should().Be(actualResponse);
        testResult.Evaluations.Should().BeEmpty();
        testResult.Duration.Should().Be(TimeSpan.FromMilliseconds(1500L));
        testResult.Id.Should().NotBe(Guid.Empty);
        testResult.CreatedAt.Should().NotBe(default);
        testResult.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public Task CreateNew_WithNullTestCase_ThrowsValidationException()
    {
        try
        {
            IServiceProvider services = GetServices();
            var factory = services.GetRequiredService<ITestResult.CreateNew>();
            var actualResponse = new AssistantMessage([Content.FromText("Result")], []);

            // ReSharper disable once NullableWarningSuppressionIsUsed
            var action = () => factory(null!, actualResponse, [], TimeSpan.Zero);
            action.Should().Throw<Exception>();
            return Task.CompletedTask;
        }
        catch (Exception exception)
        {
            return Task.FromException(exception);
        }
    }

    [TestMethod]
    public async Task CreateNew_WithNullActualResponse_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var testCase = await CreateTestCaseAsync(services);

        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(testCase, null!, [], TimeSpan.Zero);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithEvaluations_StoresEvaluations()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var createEvaluation = services.GetRequiredService<IEvaluation.Create>();
        var evaluatorGenerator = services.GetRequiredService<IDomainEntityGenerator<Trsr.Domain.Evaluator.IEvaluator>>();
        var testCase = await CreateTestCaseAsync(services);
        var actualResponse = new AssistantMessage([Content.FromText("Answer")], []);
        var evaluator = await evaluatorGenerator.GetOrCreateAsync(default);
        var evaluation = createEvaluation(evaluator, EvaluationScore.Good, "Correct");

        var testResult = factory(testCase, actualResponse, [evaluation], TimeSpan.FromMilliseconds(2000L));

        testResult.Evaluations.Should().ContainSingle().Which.Score.Should().Be(EvaluationScore.Good);
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesTestResult()
    {
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<ITestResult.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestResult>>();
        var existing = await generator.CreateAsync(CancellationToken);

        var testResult = createExisting(existing.TestCase, existing.ActualResponse, existing.Evaluations, existing.Duration, existing);

        testResult.Should().NotBeNull();
        testResult.Id.Should().Be(existing.Id);
        testResult.TestCase.Should().Be(existing.TestCase);
        testResult.ActualResponse.Should().Be(existing.ActualResponse);
        testResult.Evaluations.Should().BeEquivalentTo(existing.Evaluations);
        testResult.Duration.Should().Be(existing.Duration);
        testResult.CreatedAt.Should().Be(existing.CreatedAt);
        testResult.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public async Task Id_IsUniqueForEachNewTestResult()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var testCase = await CreateTestCaseAsync(services);
        var actualResponse = new AssistantMessage([Content.FromText("Result")], []);

        var testResult1 = factory(testCase, actualResponse, [], TimeSpan.Zero);
        var testResult2 = factory(testCase, actualResponse, [], TimeSpan.Zero);

        testResult1.Id.Should().NotBe(testResult2.Id);
    }

    private static async Task<ITestCase> CreateTestCaseAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        return await generator.CreateAsync();
    }
}
