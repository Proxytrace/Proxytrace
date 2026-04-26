using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Domain;
using Trsr.Domain.Organization;
using Trsr.Storage.Internal;

namespace Trsr.Storage.Tests;

/// <summary>
/// Integration tests for DatabaseInitializationService.ExecuteSqlScriptAsync.
/// Uses a SQLite temp file because ExecuteSqlRawAsync requires a relational provider.
/// </summary>
[TestClass]
public sealed class ExecuteSqlScriptAsyncTests
{
    private static readonly string OrgColumns = "Id, Name, CreatedAt, UpdatedAt";
    private static readonly string OrgTimestamp = "'2026-01-01T00:00:00.0000000+00:00'";

    private string _dbPath = null!;
    private IServiceProvider _services = null!;
    private DatabaseInitializationService _service = null!;

    [TestInitialize]
    public async Task TestInitialize()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"trsr_sqlexec_test_{Guid.NewGuid()}.db");
        var builder = new ContainerBuilder();
        builder.RegisterModule(new Storage.Module(StorageConfiguration.Sqlite($"Data Source={_dbPath}")));
        _services = builder.Build().Resolve<IServiceProvider>();
        _service = new DatabaseInitializationService(_services, NullLogger<DatabaseInitializationService>.Instance);

        var context = _services.GetRequiredService<StorageDbContext>();
        await context.Database.EnsureCreatedAsync();
    }

    [TestCleanup]
    public void TestCleanup()
    {
        if (File.Exists(_dbPath))
            try { File.Delete(_dbPath); } catch { }
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_ExecutesSingleStatement()
    {
        // Arrange
        var sql = $"INSERT INTO OrganizationEntity ({OrgColumns}) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org1', {OrgTimestamp}, {OrgTimestamp});";
        var countBefore = await _services.GetRequiredService<IRepository<IOrganization>>().CountAsync();

        // Act
        await _service.ExecuteSqlScriptAsync(sql);

        // Assert
        var countAfter = await _services.GetRequiredService<IRepository<IOrganization>>().CountAsync();
        countAfter.Should().Be(countBefore + 1);
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_ExecutesMultipleStatements()
    {
        // Arrange – two INSERT statements in one script separated by semicolons
        var sql = $"""
            INSERT INTO OrganizationEntity ({OrgColumns}) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org2', {OrgTimestamp}, {OrgTimestamp});
            INSERT INTO OrganizationEntity ({OrgColumns}) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Org3', {OrgTimestamp}, {OrgTimestamp});
            """;
        var countBefore = await _services.GetRequiredService<IRepository<IOrganization>>().CountAsync();

        // Act
        await _service.ExecuteSqlScriptAsync(sql);

        // Assert
        var countAfter = await _services.GetRequiredService<IRepository<IOrganization>>().CountAsync();
        countAfter.Should().Be(countBefore + 2);
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_StripsCommentLines()
    {
        // Arrange – comment lines precede a valid INSERT
        var sql = $"""
            -- This line is a comment and should be ignored
            -- So is this one
            INSERT INTO OrganizationEntity ({OrgColumns}) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Org4', {OrgTimestamp}, {OrgTimestamp});
            """;
        var countBefore = await _services.GetRequiredService<IRepository<IOrganization>>().CountAsync();

        // Act
        await _service.ExecuteSqlScriptAsync(sql);

        // Assert – INSERT executed despite comment lines
        var countAfter = await _services.GetRequiredService<IRepository<IOrganization>>().CountAsync();
        countAfter.Should().Be(countBefore + 1);
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_WithEmptyScript_DoesNotThrow()
    {
        // Act
        var action = () => _service.ExecuteSqlScriptAsync(string.Empty);

        // Assert
        await action.Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task ExecuteSqlScriptAsync_WithOnlyComments_DoesNotThrow()
    {
        // Arrange
        var sql = """
            -- Only comments here
            -- Nothing else
            """;

        // Act
        var action = () => _service.ExecuteSqlScriptAsync(sql);

        // Assert
        await action.Should().NotThrowAsync();
    }
}
