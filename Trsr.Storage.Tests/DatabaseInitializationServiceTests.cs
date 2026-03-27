using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Storage.Internal;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

/// <summary>
/// Tests for DatabaseInitializationService. Note: StartAsync tests are excluded because
/// MigrateAsync() requires a relational database provider and cannot be tested with
/// in-memory databases. The service is intended for production use with SQL Server.
/// </summary>
[TestClass]
public sealed class DatabaseInitializationServiceTests : BaseTest<Module>
{
    [TestMethod]
    public async Task StopAsync_CompletesSuccessfully()
    {
        // Arrange
        var services = GetServices();
        var logger = NullLogger<DatabaseInitializationService>.Instance;
        var service = new DatabaseInitializationService(services, logger);

        // Act
        var action = () => service.StopAsync(CancellationToken);

        // Assert
        await action.Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task StopAsync_ReturnsCompletedTask()
    {
        // Arrange
        var services = GetServices();
        var logger = NullLogger<DatabaseInitializationService>.Instance;
        var service = new DatabaseInitializationService(services, logger);

        // Act
        await service.StopAsync(CancellationToken);

        // Assert - StopAsync completes without throwing
        // No additional assertion needed - if we reach here, it completed successfully
    }
}
