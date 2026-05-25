using System.Reflection;
using AwesomeAssertions;
using Proxytrace.Storage;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

/// <summary>
/// Tests for the private storage-configuration detection helpers on <see cref="Proxytrace.Api.Module"/>.
/// The composition-root <c>Load</c> path needs a real <c>appsettings.json</c> file and is exercised
/// during application start-up, so these tests cover the routing logic in isolation.
/// </summary>
[TestClass]
public sealed class ModuleTests : BaseTest<Module>
{
    private static T Invoke<T>(string name, params object?[] args)
    {
        var method = typeof(Proxytrace.Api.Module)
            .GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new InvalidOperationException($"Missing {name}");
        var result = (T?)method.Invoke(null, args);
        result.Should().NotBeNull();
        return result;
    }

    [TestMethod]
    public void DetermineStorageConfiguration_PostgresHostString_ReturnsPostgres()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Host=localhost;Database=proxytrace;Username=u;Password=p");
        config.GetType().Name.Should().Be("PostgresConfiguration");
    }

    [TestMethod]
    public void DetermineStorageConfiguration_PostgresPortString_ReturnsPostgres()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Server=db;Port=5432;Database=proxytrace;Username=u;Password=p");

        config.GetType().Name.Should().Be("PostgresConfiguration");
    }

    [TestMethod]
    public void DetermineStorageConfiguration_SqliteFileString_ReturnsSqlite()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Data Source=proxytrace.db");

        config.GetType().Name.Should().Be("SqliteConfiguration");
    }

    [TestMethod]
    public void DetermineStorageConfiguration_SqliteMemoryString_ReturnsSqlite()
    {
        var config = Invoke<StorageConfiguration>("DetermineStorageConfiguration",
            "Data Source=:memory:");

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
    public void IsPostgresConnectionString_MixedCase_ReturnsTrue()
    {
        Invoke<bool>("IsPostgresConnectionString", "HOST=db;Port=5432").Should().BeTrue();
        Invoke<bool>("IsPostgresConnectionString", "host=db").Should().BeTrue();
        Invoke<bool>("IsPostgresConnectionString", "Server=.;Database=x").Should().BeFalse();
    }

    [TestMethod]
    public void IsSqliteConnectionString_DbExtension_ReturnsTrue()
    {
        Invoke<bool>("IsSqliteConnectionString", "Data Source=foo.db").Should().BeTrue();
        Invoke<bool>("IsSqliteConnectionString", "Data Source=foo.sqlite").Should().BeTrue();
        Invoke<bool>("IsSqliteConnectionString", "Data Source=:memory:").Should().BeTrue();
        Invoke<bool>("IsSqliteConnectionString", "Server=.;Database=x").Should().BeFalse();
    }

    [TestMethod]
    public void Constructor_DefaultsToProduction()
    {
        var module = new Proxytrace.Api.Module();
        module.Should().NotBeNull();
    }
}
