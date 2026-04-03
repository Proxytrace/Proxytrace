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
        var testResult = factory(testCase, actualResponse, Evaluation.Pass);

        // Assert
        testResult.Should().NotBeNull();
        testResult.TestCase.Should().Be(testCase);
        testResult.ActualResponse.Should().Be(actualResponse);
        testResult.Evaluation.Should().Be(Evaluation.Pass);
        testResult.Id.Should().NotBe(Guid.Empty);
        testResult.CreatedAt.Should().NotBe(default);
        testResult.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_WithNullTestCase_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestResult.CreateNew>();
        var actualResponse = new AssistantMessage([Content.FromText("Result")], []);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(null!, actualResponse, Evaluation.Pass);
        action.Should().Throw<Exception>();
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
        var action = () => factory(testCase, null!, Evaluation.Pass);
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
        var testResult = factory(testCase, actualResponse, Evaluation.Fail);

        // Assert
        testResult.Evaluation.Should().Be(Evaluation.Fail);
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
        var testResult = factory(testCase, actualResponse, Evaluation.Undecided);

        // Assert
        testResult.Evaluation.Should().Be(Evaluation.Undecided);
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
        var testResult = createExisting(existing.TestCase, existing.ActualResponse, existing.Evaluation, existing);

        // Assert
        testResult.Should().NotBeNull();
        testResult.Id.Should().Be(existing.Id);
        testResult.TestCase.Should().Be(existing.TestCase);
        testResult.ActualResponse.Should().Be(existing.ActualResponse);
        testResult.Evaluation.Should().Be(existing.Evaluation);
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
        var testResult1 = factory(testCase, actualResponse, Evaluation.Pass);
        var testResult2 = factory(testCase, actualResponse, Evaluation.Pass);

        // Assert
        testResult1.Id.Should().NotBe(testResult2.Id);
    }

    private static async Task<ITestCase> CreateTestCaseAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        return await generator.CreateAsync(default);
    }
}
