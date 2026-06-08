using Microsoft.EntityFrameworkCore;
using Proxytrace.Application.TestSupport;

namespace Proxytrace.Storage.Internal;

/// <summary>
/// PostgreSQL implementation of <see cref="ITestDataReset"/>. Truncates the per-run content tables
/// with CASCADE (which clears their dependent rows) while leaving the setup baseline — users,
/// providers, models, endpoints, api keys, projects and their settings/memberships — untouched.
/// </summary>
internal sealed class TestDataReset : ITestDataReset
{
    // Content tables only. None of the preserved baseline tables (Project/Provider/Model/
    // Endpoint/ApiKey/User/…) hold a foreign key INTO these, so CASCADE cannot reach them.
    private const string TruncateSql = """
        TRUNCATE TABLE
          "AgentCallEntity", "AgentVersionEntity", "AgentEntity",
          "EvaluatorEntity", "TestSuiteEvaluatorEntity", "TestCaseEntity", "TestSuiteEntity",
          "TestResultEntity", "TestRunEntity", "TestRunStatsEntity", "TestRunGroupEntity",
          "OptimizationProposalEntity", "InviteEntity", "ApplicationErrorEntity"
        CASCADE;
        """;

    private readonly Func<StorageDbContext> contextFactory;

    public TestDataReset(Func<StorageDbContext> contextFactory)
    {
        this.contextFactory = contextFactory;
    }

    public async Task ResetAsync(CancellationToken cancellationToken = default)
        => await contextFactory().Database.ExecuteSqlRawAsync(TruncateSql, cancellationToken);
}
