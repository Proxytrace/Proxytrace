using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Evaluation;
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
        IEntityEventService entityEvents,
        AmbientDbContext ambient) : base(mapper, contextFactory, transaction, entityEvents, ambient)
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

    public async Task<IReadOnlyList<ITestResult>> GetRecentByEvaluatorAsync(
        Guid evaluatorId,
        int count,
        EvaluationScore? score = null,
        CancellationToken cancellationToken = default)
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
            .Where(r => r.Evaluations.Any(e =>
                e.EvaluatorId == evaluatorId && (score is null || e.Score == score)))
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

    public async Task<IReadOnlyList<ITestResult>> SearchByEvaluatorAsync(
        Guid evaluatorId,
        string query,
        int count,
        CancellationToken cancellationToken = default)
    {
        if (count <= 0) return [];

        // Mirror GetRecentByEvaluatorAsync: load a recent window and filter in memory so the
        // in-memory test provider behaves identically to PostgreSQL (no relational-only operators).
        var context = contextFactory();
        var recent = await context
            .Set<TestResultEntity>()
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Take(1000)
            .ToListAsync(cancellationToken);

        var deduped = recent
            .Where(r => r.Evaluations.Any(e => e.EvaluatorId == evaluatorId))
            .GroupBy(r => r.TestCase)
            .Select(g => g.First())
            .Take(300)
            .ToList();

        // Summary is computed by the domain entity, so the text filter runs after mapping.
        var trimmed = query.Trim();
        var matches = new List<ITestResult>();
        foreach (var entity in deduped)
        {
            var mapped = await Map(entity, cancellationToken);
            if (mapped is null) continue;
            if (trimmed.Length > 0 && !MatchesQuery(mapped, evaluatorId, trimmed)) continue;
            matches.Add(mapped);
            if (matches.Count >= count) break;
        }
        return matches;
    }

    private static bool MatchesQuery(ITestResult result, Guid evaluatorId, string query)
    {
        if (result.TestCase.GetSummary().Contains(query, StringComparison.OrdinalIgnoreCase))
            return true;
        var reasoning = result.Evaluations
            .FirstOrDefault(e => e.Evaluator.Id == evaluatorId)?.Reasoning;
        return reasoning is not null && reasoning.Contains(query, StringComparison.OrdinalIgnoreCase);
    }
}
