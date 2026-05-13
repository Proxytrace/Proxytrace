using Autofac;
using AwesomeAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Application.Demo;
using Trsr.Common.Lifecycle;
using Trsr.Storage.Internal;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

/// <summary>
/// Tests for DatabaseInitializationService. SQLite-backed tests use a temp file so
/// MigrateAsync exercises the real migration pipeline; PRAGMA tests cover the WAL setup.
/// </summary>
[TestClass]
public sealed class DatabaseInitializationServiceTests : BaseTest<Module>
{
    private record TestData(string DbPath);

    protected override void ConfigureContainer(ContainerBuilder builder)
    {
        base.ConfigureContainer(builder);

        builder.Register(sp =>
        {
            var serviceProvider  = sp.Resolve<IServiceProvider>();
            ITempDirectory tempPath = serviceProvider.GetTempDirectory(prefix: "trsr-tests");
            var dbPath = tempPath.Combine($"trsr_init_{Guid.NewGuid():N}.db");
            return new TestData(dbPath);
        }).SingleInstance();

        builder.RegisterModule(new Storage.Module(sp =>
        {
            var data = sp.GetRequiredService<TestData>();
            return StorageConfiguration.Sqlite($"Data Source={data.DbPath}");
        }));
    }

    [TestMethod]
    public async Task StopAsync_CompletesSuccessfully()
    {
        var services = GetServices();
        var service = new DatabaseInitializationService(services, StorageConfiguration.InMemory(),
            NullLogger<DatabaseInitializationService>.Instance);

        await service.Invoking(s => s.StopAsync(CancellationToken)).Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task EnsureDatabaseReadyAsync_OnFreshSqliteFile_CreatesMigratedSchema()
    {
        var services = GetServices();
        var service = services.GetRequiredService<IDatabaseInitializer>();
        var testData = services.GetRequiredService<TestData>();

        await service.EnsureDatabaseReadyAsync(CancellationToken);

        File.Exists(testData.DbPath).Should().BeTrue();
        var ctx = services.GetRequiredService<StorageDbContext>();
        var history = await ctx.Database.GetAppliedMigrationsAsync(CancellationToken);
        history.Should().NotBeEmpty();
    }

    [TestMethod]
    public async Task EnsureDatabaseReadyAsync_OnLegacySqliteFile_DropsTablesAndRebuilds()
    {
        var services = GetServices();
        TestData data = services.GetRequiredService<TestData>();

        // Seed a legacy DB: a SQLite file with user tables but no migrations history.
        await using (var legacy = new SqliteConnection($"Data Source={data.DbPath}"))
        {
            await legacy.OpenAsync(CancellationToken);
            await using var cmd = legacy.CreateCommand();
            cmd.CommandText = "CREATE TABLE LegacyJunk (Id INTEGER PRIMARY KEY)";
            await cmd.ExecuteNonQueryAsync(CancellationToken);
        }

        var service = services.GetRequiredService<IDatabaseInitializer>();

        await service.EnsureDatabaseReadyAsync(CancellationToken);

        // Legacy table dropped, migrated schema present.
        await using var conn = new SqliteConnection($"Data Source={data.DbPath}");
        await conn.OpenAsync(CancellationToken);
        await using var check = conn.CreateCommand();
        check.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE name='LegacyJunk'";
        var scalar = await check.ExecuteScalarAsync(CancellationToken);
        scalar.Should().NotBeNull();
        ((long)scalar).Should().Be(0);
    }

    [TestMethod]
    public async Task StartAsync_OnSqliteFile_DelegatesToEnsureReady()
    {
        var services = GetServices();
        TestData data = services.GetRequiredService<TestData>();
        
        var sut = new DatabaseInitializationService(
            services,
            StorageConfiguration.Sqlite($"Data Source={data.DbPath}"),
            NullLogger<DatabaseInitializationService>.Instance);

        await sut.StartAsync(CancellationToken);

        File.Exists(data.DbPath).Should().BeTrue();
    }
}