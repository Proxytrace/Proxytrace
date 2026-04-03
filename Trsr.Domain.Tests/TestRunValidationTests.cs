using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class TestRunValidationTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesTestRun()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestRun.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var testResult = await CreateTestResultAsync(services);
        var timestamp = DateTimeOffset.UtcNow.AddMinutes(-1);

        // Act
        var testRun = factory(timestamp, agent, [testResult]);

        // Assert
        testRun.Should().NotBeNull();
        testRun.Timestamp.Should().Be(timestamp);
        testRun.Agent.Should().Be(agent);
        testRun.TestResults.Should().ContainSingle();
        testRun.Id.Should().NotBe(Guid.Empty);
        testRun.CreatedAt.Should().NotBe(default);
        testRun.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_WithNullAgent_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestRun.CreateNew>();
        var testResult = await CreateTestResultAsync(services);
        var timestamp = DateTimeOffset.UtcNow.AddMinutes(-1);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(timestamp, null!, [testResult]);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullTestResults_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestRun.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var timestamp = DateTimeOffset.UtcNow.AddMinutes(-1);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(timestamp, agent, null!);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithFutureTimestamp_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestRun.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var testResult = await CreateTestResultAsync(services);
        var futureTimestamp = DateTimeOffset.UtcNow.AddHours(1);

        // Act & Assert
        var action = () => factory(futureTimestamp, agent, [testResult]);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithEmptyTestResults_CreatesTestRun()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestRun.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var timestamp = DateTimeOffset.UtcNow.AddMinutes(-1);

        // Act
        var testRun = factory(timestamp, agent, []);

        // Assert
        testRun.Should().NotBeNull();
        testRun.TestResults.Should().BeEmpty();
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesTestRun()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<ITestRun.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestRun>>();
        var existing = await generator.CreateAsync(CancellationToken);

        // Act
        var testRun = createExisting(existing.Timestamp, existing.Agent, existing.TestResults, existing);

        // Assert
        testRun.Should().NotBeNull();
        testRun.Id.Should().Be(existing.Id);
        testRun.Timestamp.Should().Be(existing.Timestamp);
        testRun.Agent.Should().Be(existing.Agent);
        testRun.CreatedAt.Should().Be(existing.CreatedAt);
        testRun.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public async Task Id_IsUniqueForEachNewTestRun()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestRun.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var testResult = await CreateTestResultAsync(services);
        var timestamp = DateTimeOffset.UtcNow.AddMinutes(-1);

        // Act
        var testRun1 = factory(timestamp, agent, [testResult]);
        var testRun2 = factory(timestamp, agent, [testResult]);

        // Assert
        testRun1.Id.Should().NotBe(testRun2.Id);
    }

    private static async Task<IAgent> CreateTestAgentAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        return await generator.GetOrCreateAsync(default);
    }

    private static async Task<ITestResult> CreateTestResultAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestResult>>();
        return await generator.CreateAsync(default);
    }
}
