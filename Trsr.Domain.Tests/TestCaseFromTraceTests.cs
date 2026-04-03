using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

/// <summary>
/// Tests for creating test cases from traced agent calls (promoting traces to test cases).
/// </summary>
[TestClass]
public sealed class TestCaseFromTraceTests : BaseTest<Module>
{
    [TestMethod]
    public void CreateNew_WithSourceAgentCallId_StoresSourceId()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("Hello")], []);
        var sourceCallId = Guid.NewGuid();

        // Act
        var testCase = factory(input, expectedOutput, sourceCallId);

        // Assert
        testCase.SourceAgentCallId.Should().Be(sourceCallId);
    }

    [TestMethod]
    public void CreateNew_WithoutSourceAgentCallId_HasNullSourceId()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("Hello")], []);

        // Act
        var testCase = factory(input, expectedOutput);

        // Assert
        testCase.SourceAgentCallId.Should().BeNull();
    }

    [TestMethod]
    public void CreateNew_WithExplicitNullSourceId_HasNullSourceId()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("Hello")], []);

        // Act
        var testCase = factory(input, expectedOutput, null);

        // Assert
        testCase.SourceAgentCallId.Should().BeNull();
    }

    [TestMethod]
    public async Task CreateExisting_WithSourceAgentCallId_PreservesSourceId()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createNew = services.GetRequiredService<ITestCase.CreateNew>();
        var createExisting = services.GetRequiredService<ITestCase.CreateExisting>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("Hello")], []);
        var sourceCallId = Guid.NewGuid();

        var original = createNew(input, expectedOutput, sourceCallId);

        // Act
        var reconstituted = createExisting(original.Input, original.ExpectedOutput, original, original.SourceAgentCallId);

        // Assert
        reconstituted.SourceAgentCallId.Should().Be(sourceCallId);
        reconstituted.Id.Should().Be(original.Id);
    }

    [TestMethod]
    public async Task CreateExisting_WithNullSourceId_HasNullSourceId()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var createExisting = services.GetRequiredService<ITestCase.CreateExisting>();
        var existing = await generator.CreateAsync(CancellationToken);

        // Act
        var testCase = createExisting(existing.Input, existing.ExpectedOutput, existing, null);

        // Assert
        testCase.SourceAgentCallId.Should().BeNull();
    }

    [TestMethod]
    public void SourceAgentCallId_IsDifferentAcrossIndependentTestCases()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("Hello")], []);
        var sourceCallId1 = Guid.NewGuid();
        var sourceCallId2 = Guid.NewGuid();

        // Act
        var testCase1 = factory(input, expectedOutput, sourceCallId1);
        var testCase2 = factory(input, expectedOutput, sourceCallId2);

        // Assert
        testCase1.SourceAgentCallId.Should().Be(sourceCallId1);
        testCase2.SourceAgentCallId.Should().Be(sourceCallId2);
    }
}
