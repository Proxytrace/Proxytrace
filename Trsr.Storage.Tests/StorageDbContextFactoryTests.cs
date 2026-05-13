using System.Reflection;
using AwesomeAssertions;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class StorageDbContextFactoryTests
{
    private static T Invoke<T>(string name, params object?[] args)
    {
        var method = typeof(StorageDbContextFactory)
            .GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new InvalidOperationException($"Missing {name}");
        return (T)method.Invoke(null, args)!;
    }

    [TestMethod]
    public void DetermineStorageConfiguration_PostgresString_ReturnsPostgres()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Host=db;Port=5432;Database=trsr");

        config.GetType().Name.Should().Be("PostgresConfiguration");
    }

    [TestMethod]
    public void DetermineStorageConfiguration_SqliteString_ReturnsSqlite()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Data Source=trsr.db");

        config.GetType().Name.Should().Be("SqliteConfiguration");
    }

    [TestMethod]
    public void DetermineStorageConfiguration_SqlServerString_ReturnsSqlServer()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Server=.;Database=trsr;Trusted_Connection=True;");

        config.GetType().Name.Should().Be("SqlServerConfiguration");
    }

    [TestMethod]
    public void IsPostgresConnectionString_DetectsHostAndPort()
    {
        Invoke<bool>("IsPostgresConnectionString", "Host=localhost").Should().BeTrue();
        Invoke<bool>("IsPostgresConnectionString", "PORT=5432").Should().BeTrue();
        Invoke<bool>("IsPostgresConnectionString", "Server=.;Database=x").Should().BeFalse();
    }

    [TestMethod]
    public void IsSqliteConnectionString_RequiresDataSourceAndExtension()
    {
        Invoke<bool>("IsSqliteConnectionString", "Data Source=foo.db").Should().BeTrue();
        Invoke<bool>("IsSqliteConnectionString", "Data Source=:memory:").Should().BeTrue();
        Invoke<bool>("IsSqliteConnectionString", "Data Source=foo.sqlite").Should().BeTrue();
        // Has Data Source but no recognized extension token — not sqlite.
        Invoke<bool>("IsSqliteConnectionString", "Data Source=server").Should().BeFalse();
        Invoke<bool>("IsSqliteConnectionString", "Server=.;Database=x").Should().BeFalse();
    }

    [TestMethod]
    public void CreateDbContext_WithSqliteAppSettings_BuildsContext()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "trsr-dbctx-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var prevCwd = Directory.GetCurrentDirectory();
        try
        {
            File.WriteAllText(
                Path.Combine(tempDir, "appsettings.json"),
                """{"ConnectionStrings":{"Default":"Data Source=:memory:"}}""");
            Directory.SetCurrentDirectory(tempDir);

            var factory = new StorageDbContextFactory();
            using var ctx = factory.CreateDbContext([]);

            ctx.Should().NotBeNull();
        }
        finally
        {
            Directory.SetCurrentDirectory(prevCwd);
            Directory.Delete(tempDir, recursive: true);
        }
    }

    [TestMethod]
    public void CreateDbContext_MissingConnectionString_Throws()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "trsr-dbctx-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var prevCwd = Directory.GetCurrentDirectory();
        try
        {
            File.WriteAllText(Path.Combine(tempDir, "appsettings.json"), "{}");
            Directory.SetCurrentDirectory(tempDir);

            var factory = new StorageDbContextFactory();
            var act = () => factory.CreateDbContext([]);

            act.Should().Throw<InvalidOperationException>();
        }
        finally
        {
            Directory.SetCurrentDirectory(prevCwd);
            Directory.Delete(tempDir, recursive: true);
        }
    }
}
