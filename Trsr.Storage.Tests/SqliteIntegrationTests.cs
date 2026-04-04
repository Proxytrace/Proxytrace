using AwesomeAssertions;
using Autofac;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Trsr.Domain;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public class SqliteIntegrationTests : BaseTest<SqliteTestModule>
{
    private static string? _testDbPath;

    [TestInitialize]
    public async Task TestInitialize()
    {
        // Create a unique temporary database file for each test
        _testDbPath = Path.Combine(Path.GetTempPath(), $"trsr_test_{Guid.NewGuid()}.db");
    }

    [TestCleanup]
    public void TestCleanup()
    {
        // Clean up the test database file
        if (_testDbPath != null && File.Exists(_testDbPath))
        {
            try
            {
                File.Delete(_testDbPath);
            }
            catch
            {
                // Ignore cleanup errors
            }
        }
    }

    [TestMethod]
    public async Task SqliteConfiguration_CanPersistAndRetrieveUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        
        // Ensure database schema is created
        var dbContext = services.GetRequiredService<StorageDbContext>();
        await dbContext.Database.EnsureCreatedAsync(CancellationToken);
        
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var repository = services.GetRequiredService<IRepository<IUser>>();
        
        // Act - Create a user
        IUser createdUser = await generator.CreateAsync(CancellationToken);
        
        // Assert - Retrieve the user
        IUser retrievedUser = await repository.GetAsync(createdUser.Id, CancellationToken);
        retrievedUser.Should().NotBeNull();
        retrievedUser.Id.Should().Be(createdUser.Id);
        retrievedUser.Name.Should().Be(createdUser.Name);
    }

    [TestMethod]
    public void SqliteConfiguration_SupportsMigrations()
    {
        // Arrange
        var config = StorageConfiguration.Sqlite("Data Source=:memory:");
        
        // Assert
        config.SupportsMigrations.Should().BeTrue();
    }
}

/// <summary>
/// Test module that configures SQLite storage instead of InMemory
/// </summary>
public class SqliteTestModule : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        // Use SQLite with a temporary file-based database for testing
        var testDbPath = Path.Combine(Path.GetTempPath(), $"trsr_sqlite_test_{Guid.NewGuid()}.db");
        builder.RegisterModule(new Storage.Module(StorageConfiguration.Sqlite($"Data Source={testDbPath}")));
    }
}





