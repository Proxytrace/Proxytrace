using System.Reflection;
using AwesomeAssertions;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class StorageDbContextFactoryTests : BaseTest<Module>
{
    private static T Invoke<T>(string name, params object?[] args)
    {
        var method = typeof(StorageDbContextFactory)
            .GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new InvalidOperationException($"Missing {name}");
        return (T?)method.Invoke(null, args) 
               ?? throw new InvalidOperationException($"Method {name} returned null");
    }

    [TestMethod]
    public void DetermineStorageConfiguration_PostgresString_ReturnsPostgres()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Host=db;Port=5432;Database=proxytrace");

        config.GetType().Name.Should().Be("PostgresConfiguration");
    }

    [TestMethod]
    public void DetermineStorageConfiguration_SqliteString_ReturnsSqlite()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Data Source=proxytrace.db");

        config.GetType().Name.Should().Be("SqliteConfiguration");
    }

    [TestMethod]
    public void DetermineStorageConfiguration_SqlServerString_ReturnsSqlServer()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Server=.;Database=proxytrace;Trusted_Connection=True;");

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
        var services = GetServices();
        using var tempDir = services.GetTempDirectory(prefix: "proxytrace-dbctx-");
        var prevCwd = Directory.GetCurrentDirectory();
        try
        {
            File.WriteAllText(
                Path.Combine(tempDir.Path, "appsettings.json"),
                """{"ConnectionStrings":{"Default":"Data Source=:memory:"}}""");
            Directory.SetCurrentDirectory(tempDir.Path);

            var factory = new StorageDbContextFactory();
            using var ctx = factory.CreateDbContext([]);

            ctx.Should().NotBeNull();
        }
        finally
        {
            Directory.SetCurrentDirectory(prevCwd);
        }
    }

    [TestMethod]
    public void CreateDbContext_MissingConnectionString_Throws()
    {
        var services = GetServices();
        using var tempDir = services.GetTempDirectory(prefix: "proxytrace-dbctx-");
        var prevCwd = Directory.GetCurrentDirectory();
        try
        {
            File.WriteAllText(Path.Combine(tempDir.Path, "appsettings.json"), "{}");
            Directory.SetCurrentDirectory(tempDir.Path);

            var factory = new StorageDbContextFactory();
            var act = () => factory.CreateDbContext([]);

            act.Should().Throw<InvalidOperationException>();
        }
        finally
        {
            Directory.SetCurrentDirectory(prevCwd);
        }
    }
}
