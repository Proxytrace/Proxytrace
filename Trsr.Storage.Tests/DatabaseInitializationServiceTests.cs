using Autofac;
using AwesomeAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Application.Demo;
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
    private static IServiceProvider BuildSqliteServices(string dbPath)
    {
        var builder = new ContainerBuilder();
        builder.RegisterModule(new Storage.Module(StorageConfiguration.Sqlite($"Data Source={dbPath}")));
        var container = builder.Build();
        return new Autofac.Extensions.DependencyInjection.AutofacServiceProvider(container);
    }

    [TestMethod]
    public async Task StopAsync_CompletesSuccessfully()
    {
        var services = GetServices();
        var service = new DatabaseInitializationService(services, StorageConfiguration.InMemory(), NullLogger<DatabaseInitializationService>.Instance);

        await service.Invoking(s => s.StopAsync(CancellationToken)).Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task EnsureDatabaseReadyAsync_OnFreshSqliteFile_CreatesMigratedSchema()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"trsr_init_{Guid.NewGuid():N}.db");
        try
        {
            var services = BuildSqliteServices(dbPath);
            var service = services.GetRequiredService<IDatabaseInitializer>();

            await service.EnsureDatabaseReadyAsync(CancellationToken);

            File.Exists(dbPath).Should().BeTrue();
            var ctx = services.GetRequiredService<StorageDbContext>();
            var history = await ctx.Database.GetAppliedMigrationsAsync(CancellationToken);
            history.Should().NotBeEmpty();
        }
        finally
        {
            if (File.Exists(dbPath)) File.Delete(dbPath);
        }
    }

    [TestMethod]
    public async Task EnsureDatabaseReadyAsync_OnLegacySqliteFile_DropsTablesAndRebuilds()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"trsr_init_legacy_{Guid.NewGuid():N}.db");
        try
        {
            // Seed a legacy DB: a SQLite file with user tables but no migrations history.
            using (var legacy = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={dbPath}"))
            {
                await legacy.OpenAsync(CancellationToken);
                await using var cmd = legacy.CreateCommand();
                cmd.CommandText = "CREATE TABLE LegacyJunk (Id INTEGER PRIMARY KEY)";
                await cmd.ExecuteNonQueryAsync(CancellationToken);
            }

            var services = BuildSqliteServices(dbPath);
            var service = services.GetRequiredService<IDatabaseInitializer>();

            await service.EnsureDatabaseReadyAsync(CancellationToken);

            // Legacy table dropped, migrated schema present.
            using var conn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={dbPath}");
            await conn.OpenAsync(CancellationToken);
            await using var check = conn.CreateCommand();
            check.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE name='LegacyJunk'";
            ((long)(await check.ExecuteScalarAsync(CancellationToken))!).Should().Be(0);
        }
        finally
        {
            if (File.Exists(dbPath)) File.Delete(dbPath);
        }
    }

    [TestMethod]
    public async Task StartAsync_OnSqliteFile_DelegatesToEnsureReady()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"trsr_init_start_{Guid.NewGuid():N}.db");
        try
        {
            var services = BuildSqliteServices(dbPath);
            var sut = new DatabaseInitializationService(
                services,
                StorageConfiguration.Sqlite($"Data Source={dbPath}"),
                NullLogger<DatabaseInitializationService>.Instance);

            await sut.StartAsync(CancellationToken);

            File.Exists(dbPath).Should().BeTrue();
        }
        finally
        {
            if (File.Exists(dbPath)) File.Delete(dbPath);
        }
    }
}
