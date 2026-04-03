using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.TestCase;
using Trsr.Domain.Message;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

/// <summary>
/// Storage-layer tests verifying that TestCase entities created from traces
/// correctly persist and retrieve the SourceAgentCallId link.
/// </summary>
[TestClass]
public sealed class TestCaseFromTraceRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task AddAsync_TestCaseWithSourceAgentCallId_PersistsSourceId()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<ITestCaseRepository>();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("expected")], []);
        var sourceCallId = Guid.NewGuid();

        var testCase = factory(input, expectedOutput, sourceCallId);

        // Act
        var saved = await repository.AddAsync(testCase, CancellationToken);
        var retrieved = await repository.GetAsync(saved.Id, CancellationToken);

        // Assert
        retrieved.SourceAgentCallId.Should().Be(sourceCallId);
    }

    [TestMethod]
    public async Task AddAsync_TestCaseWithoutSourceAgentCallId_PersistsNullSourceId()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<ITestCaseRepository>();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var input = Conversation.Create();
        var expectedOutput = new AssistantMessage([Content.FromText("expected")], []);

        var testCase = factory(input, expectedOutput);

        // Act
        var saved = await repository.AddAsync(testCase, CancellationToken);
        var retrieved = await repository.GetAsync(saved.Id, CancellationToken);

        // Assert
        retrieved.SourceAgentCallId.Should().BeNull();
    }

    [TestMethod]
    public async Task AddAsync_MultipleTestCasesFromSameTrace_AllHaveSameSourceId()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<ITestCaseRepository>();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var sourceCallId = Guid.NewGuid();

        var tc1 = factory(Conversation.Create(), new AssistantMessage([Content.FromText("a")], []), sourceCallId);
        var tc2 = factory(Conversation.Create(), new AssistantMessage([Content.FromText("b")], []), sourceCallId);

        // Act
        var saved1 = await repository.AddAsync(tc1, CancellationToken);
        var saved2 = await repository.AddAsync(tc2, CancellationToken);

        var retrieved1 = await repository.GetAsync(saved1.Id, CancellationToken);
        var retrieved2 = await repository.GetAsync(saved2.Id, CancellationToken);

        // Assert
        retrieved1.SourceAgentCallId.Should().Be(sourceCallId);
        retrieved2.SourceAgentCallId.Should().Be(sourceCallId);
    }

    [TestMethod]
    public async Task AddAsync_TestCasesFromDifferentTraces_HaveDistinctSourceIds()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<ITestCaseRepository>();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var sourceCallId1 = Guid.NewGuid();
        var sourceCallId2 = Guid.NewGuid();

        var tc1 = factory(Conversation.Create(), new AssistantMessage([Content.FromText("a")], []), sourceCallId1);
        var tc2 = factory(Conversation.Create(), new AssistantMessage([Content.FromText("b")], []), sourceCallId2);

        // Act
        await repository.AddAsync(tc1, CancellationToken);
        await repository.AddAsync(tc2, CancellationToken);

        var retrieved1 = await repository.GetAsync(tc1.Id, CancellationToken);
        var retrieved2 = await repository.GetAsync(tc2.Id, CancellationToken);

        // Assert
        retrieved1.SourceAgentCallId.Should().Be(sourceCallId1);
        retrieved2.SourceAgentCallId.Should().Be(sourceCallId2);
    }

    [TestMethod]
    public async Task GetAllAsync_ReturnsTestCasesWithCorrectSourceIds()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<ITestCaseRepository>();
        var factory = services.GetRequiredService<ITestCase.CreateNew>();
        var sourceCallId = Guid.NewGuid();

        var withSource = factory(Conversation.Create(), new AssistantMessage([Content.FromText("from trace")], []), sourceCallId);
        var withoutSource = factory(Conversation.Create(), new AssistantMessage([Content.FromText("manual")], []));

        await repository.AddAsync(withSource, CancellationToken);
        await repository.AddAsync(withoutSource, CancellationToken);

        // Act
        var all = await repository.GetAllAsync(CancellationToken);

        // Assert
        all.Should().Contain(tc => tc.Id == withSource.Id && tc.SourceAgentCallId == sourceCallId);
        all.Should().Contain(tc => tc.Id == withoutSource.Id && tc.SourceAgentCallId == null);
    }
}
