using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
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
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var testCase = await CreateTestCaseAsync(services);
        var actualResponse = new AssistantMessage([Content.FromText("Result")], []);

        // Act
        var testResult = factory(testCase, actualResponse, Evaluation.Pass, TimeSpan.FromMilliseconds(1500L));

        // Assert
        testResult.Should().NotBeNull();
        testResult.TestCase.Should().Be(testCase);
        testResult.ActualResponse.Should().Be(actualResponse);
        testResult.Evaluations.Should().Be(Evaluation.Pass);
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
            // Arrange
            IServiceProvider services = GetServices();
            var factory = services.GetRequiredService<ITestResult.CreateNew>();
            var actualResponse = new AssistantMessage([Content.FromText("Result")], []);

            // Act & Assert
            // ReSharper disable once NullableWarningSuppressionIsUsed
            var action = () => factory(null!, actualResponse, Evaluation.Pass, TimeSpan.Zero);
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
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var testCase = await CreateTestCaseAsync(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(testCase, null!, Evaluation.Pass, TimeSpan.Zero);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithFailEvaluation_CreatesTestResult()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var testCase = await CreateTestCaseAsync(services);
        var actualResponse = new AssistantMessage([Content.FromText("Wrong answer")], []);

        // Act
        var testResult = factory(testCase, actualResponse, Evaluation.Fail, TimeSpan.FromMilliseconds(2000L));

        // Assert
        testResult.Evaluations.Should().Be(Evaluation.Fail);
    }

    [TestMethod]
    public async Task CreateNew_WithUndecidedEvaluation_CreatesTestResult()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var testCase = await CreateTestCaseAsync(services);
        var actualResponse = new AssistantMessage([Content.FromText("Unclear answer")], []);

        // Act
        var testResult = factory(testCase, actualResponse, Evaluation.Undecided, TimeSpan.FromMilliseconds(3000L));

        // Assert
        testResult.Evaluations.Should().Be(Evaluation.Undecided);
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesTestResult()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<ITestResult.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestResult>>();
        var existing = await generator.CreateAsync(CancellationToken);

        // Act
        var testResult = createExisting(existing.TestCase, existing.ActualResponse, existing.Evaluations, existing.Duration, existing);

        // Assert
        testResult.Should().NotBeNull();
        testResult.Id.Should().Be(existing.Id);
        testResult.TestCase.Should().Be(existing.TestCase);
        testResult.ActualResponse.Should().Be(existing.ActualResponse);
        testResult.Evaluations.Should().Be(existing.Evaluations);
        testResult.Duration.Should().Be(existing.Duration);
        testResult.CreatedAt.Should().Be(existing.CreatedAt);
        testResult.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public async Task Id_IsUniqueForEachNewTestResult()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var testCase = await CreateTestCaseAsync(services);
        var actualResponse = new AssistantMessage([Content.FromText("Result")], []);

        // Act
        var testResult1 = factory(testCase, actualResponse, Evaluation.Pass, TimeSpan.Zero);
        var testResult2 = factory(testCase, actualResponse, Evaluation.Pass, TimeSpan.Zero);

        // Assert
        testResult1.Id.Should().NotBe(testResult2.Id);
    }

    private static async Task<ITestCase> CreateTestCaseAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        return await generator.CreateAsync();
    }
}
