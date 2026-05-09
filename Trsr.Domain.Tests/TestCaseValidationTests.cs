using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class TestCaseValidationTests : BaseTest<Module>
{
    [TestMethod]
    public void CreateNew_WithValidInputs_CreatesTestCase()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("Hello")], []);

        // Act
        var testCase = factory(input, expectedOutput);

        // Assert
        testCase.Should().NotBeNull();
        testCase.Input.Should().Be(input);
        testCase.ExpectedOutput.Should().Be(expectedOutput);
        testCase.Id.Should().NotBe(Guid.Empty);
        testCase.CreatedAt.Should().NotBe(default);
        testCase.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public void CreateNew_WithNullInput_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var expectedOutput = new AssistantMessage([Content.FromText("Hello")], []);

        // Act & Assert
        var action = () => factory.DynamicInvoke(null, expectedOutput);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithNullExpectedOutput_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();

        // Act & Assert
        var action = () => factory.DynamicInvoke(input, null);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesTestCase()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<ITestCase.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var existing = await generator.CreateAsync(CancellationToken);

        // Act
        var testCase = createExisting(existing.Input, existing.ExpectedOutput, existing);

        // Assert
        testCase.Should().NotBeNull();
        testCase.Id.Should().Be(existing.Id);
        testCase.Input.Should().Be(existing.Input);
        testCase.ExpectedOutput.Should().Be(existing.ExpectedOutput);
        testCase.CreatedAt.Should().Be(existing.CreatedAt);
        testCase.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewTestCase()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("Hello")], []);

        // Act
        var testCase1 = factory(input, expectedOutput);
        var testCase2 = factory(input, expectedOutput);

        // Assert
        testCase1.Id.Should().NotBe(testCase2.Id);
    }
}
