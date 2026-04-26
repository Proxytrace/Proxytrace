using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Domain;
using Trsr.Domain.Organization;
using Trsr.Storage.Internal;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

/// <summary>
/// Integration tests for DatabaseInitializationService.ExecuteSqlScriptAsync.
/// Uses a SQLite temp file because ExecuteSqlRawAsync requires a relational provider.
/// </summary>
[TestClass]
public sealed class ExecuteSqlScriptAsyncTests : BaseTest<Module>
{
    private const string OrgColumns = "Id, Name, CreatedAt, UpdatedAt";
    private const string OrgTimestamp = "'2026-01-01T00:00:00.0000000+00:00'";

    // ReSharper disable once NullableWarningSuppressionIsUsed
    private string dbPath = null!;

    protected override void ConfigureContainer(ContainerBuilder builder)
    {
        base.ConfigureContainer(builder);
        dbPath = Path.Combine(Path.GetTempPath(), $"trsr_sqlexec_test_{Guid.NewGuid()}.db");
        builder.RegisterModule(new Storage.Module(StorageConfiguration.Sqlite($"Data Source={dbPath}")));
        builder.RegisterInstance(NullLogger<DatabaseInitializationService>.Instance)
            .As<ILogger<DatabaseInitializationService>>();
        builder.RegisterType<DatabaseInitializationService>()
            .AsImplementedInterfaces()
            .AsSelf();

        builder.RegisterBuildCallback(c =>
        {
            var sp = c.Resolve<IServiceProvider>();
            var initializer = sp.GetRequiredService<IDatabaseInitializer>();
            initializer.EnsureDatabaseReadyAsync().GetAwaiter().GetResult();
        });
    }

    [TestInitialize]
    public void TestInitialize()
    {
        dbPath = Path.Combine(Path.GetTempPath(), $"trsr_sqlexec_test_{Guid.NewGuid()}.db");
    }

    [TestCleanup]
    public void TestCleanup()
    {
        if (File.Exists(dbPath))
        {
            try
            {
                File.Delete(dbPath);
            }
            catch
            {
                // ignored
            }
        }
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_ExecutesSingleStatement()
    {
        var services = GetServices();
        var service = services.GetRequiredService<DatabaseInitializationService>();
        
        // Arrange
        var sql =
            $"INSERT INTO OrganizationEntity ({OrgColumns}) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org1', {OrgTimestamp}, {OrgTimestamp});";
        var countBefore = await services.GetRequiredService<IRepository<IOrganization>>().CountAsync();

        // Act
        await service.ExecuteSqlScriptAsync(sql);

        // Assert
        var countAfter = await services.GetRequiredService<IRepository<IOrganization>>().CountAsync();
        countAfter.Should().Be(countBefore + 1);
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_ExecutesMultipleStatements()
    {
        var services = GetServices();
        var service = services.GetRequiredService<DatabaseInitializationService>();

        // Arrange – two INSERT statements in one script separated by semicolons
        var sql = $"""
                   INSERT INTO OrganizationEntity ({OrgColumns}) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org2', {OrgTimestamp}, {OrgTimestamp});
                   INSERT INTO OrganizationEntity ({OrgColumns}) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Org3', {OrgTimestamp}, {OrgTimestamp});
                   """;
        var countBefore = await services.GetRequiredService<IRepository<IOrganization>>().CountAsync();

        // Act
        await service.ExecuteSqlScriptAsync(sql);

        // Assert
        var countAfter = await services.GetRequiredService<IRepository<IOrganization>>().CountAsync();
        countAfter.Should().Be(countBefore + 2);
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_StripsCommentLines()
    {
        var services = GetServices();
        var service = services.GetRequiredService<DatabaseInitializationService>();

        // Arrange – comment lines precede a valid INSERT
        var sql = $"""
                   -- This line is a comment and should be ignored
                   -- So is this one
                   INSERT INTO OrganizationEntity ({OrgColumns}) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Org4', {OrgTimestamp}, {OrgTimestamp});
                   """;
        var countBefore = await services.GetRequiredService<IRepository<IOrganization>>().CountAsync();

        // Act
        await service.ExecuteSqlScriptAsync(sql);

        // Assert – INSERT executed despite comment lines
        var countAfter = await services.GetRequiredService<IRepository<IOrganization>>().CountAsync();
        countAfter.Should().Be(countBefore + 1);
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_WithEmptyScript_DoesNotThrow()
    {
        var services = GetServices();
        var service = services.GetRequiredService<DatabaseInitializationService>();

        // Act
        var action = () => service.ExecuteSqlScriptAsync(string.Empty);

        // Assert
        await action.Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_WithOnlyComments_DoesNotThrow()
    {
        var services = GetServices();
        var service = services.GetRequiredService<DatabaseInitializationService>();

        // Arrange
        var sql = """
                  -- Only comments here
                  -- Nothing else
                  """;

        // Act
        var action = () => service.ExecuteSqlScriptAsync(sql);

        // Assert
        await action.Should().NotThrowAsync();
    }
}