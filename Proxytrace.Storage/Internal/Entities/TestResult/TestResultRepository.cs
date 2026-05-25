using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.TestResult;

namespace Proxytrace.Storage.Internal.Entities.TestResult;

[UsedImplicitly]
internal class TestResultRepository : AbstractRepository<ITestResult, TestResultEntity>, ITestResultRepository
{
    public TestResultRepository(
        IMapper<ITestResult, TestResultEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }

    public async Task<ITestResult?> GetLatestByTestCaseAsync(Guid testCaseId, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var stored = await context
            .Set<TestResultEntity>()
            .AsNoTracking()
            .Where(r => r.TestCase == testCaseId)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }

    public async Task<ITestResult?> GetLatestByEvaluatorAsync(Guid evaluatorId, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var recent = await context
            .Set<TestResultEntity>()
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);

        var match = recent.FirstOrDefault(r => r.Evaluations.Any(e => e.EvaluatorId == evaluatorId));
        if (match is null) return null;

        return await Map(match, cancellationToken);
    }

    public async Task<IReadOnlyList<ITestResult>> GetRecentByEvaluatorAsync(Guid evaluatorId, int count, CancellationToken cancellationToken = default)
    {
        if (count <= 0) return [];

        var context = contextFactory();
        var recent = await context
            .Set<TestResultEntity>()
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Take(500)
            .ToListAsync(cancellationToken);

        var matching = recent
            .Where(r => r.Evaluations.Any(e => e.EvaluatorId == evaluatorId))
            .GroupBy(r => r.TestCase)
            .Select(g => g.First())
            .Take(count)
            .ToList();

        var mapped = new List<ITestResult>(matching.Count);
        foreach (var r in matching)
        {
            var m = await Map(r, cancellationToken);
            if (m is not null) mapped.Add(m);
        }
        return mapped;
    }
}
