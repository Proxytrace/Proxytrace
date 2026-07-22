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

    // The EvaluationStat projection rows copy the parent's CreatedAt at write time, but the base
    // update only copies scalar columns onto the tracked row — the projection children were left
    // untouched, so an update that rewrites CreatedAt (the demo seed's statistics backdating) kept
    // the stat rows at their original timestamps and the evaluator-stats queries bucketed on stale
    // times. Rebuild the projection from the freshly mapped entity so it always mirrors the parent.
    protected override async Task UpdateRelationsAsync(
        StorageDbContext context,
        TestResultEntity storedEntity,
        CancellationToken cancellationToken)
    {
        var stale = await context.Set<EvaluationStatEntity>()
            .Where(e => e.TestResultId == storedEntity.Id)
            .ToListAsync(cancellationToken);
        context.Set<EvaluationStatEntity>().RemoveRange(stale);
        context.Set<EvaluationStatEntity>().AddRange(storedEntity.EvaluationStats);
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
        // Project only the columns the evaluator filter needs (skips the large ActualResponse
        // payload) to find the matching row, then load that single full row for mapping.
        var recent = await ScanWindowQuery(context, 200).ToListAsync(cancellationToken);

        var matchId = recent
            .FirstOrDefault(r => r.Evaluations.Any(e => e.EvaluatorId == evaluatorId))?.Id;
        if (matchId is null) return null;

        var entity = await context
            .Set<TestResultEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == matchId.Value, cancellationToken);
        return await Map(entity, cancellationToken);
    }

    public async Task<IReadOnlyList<ITestResult>> GetRecentByEvaluatorAsync(
        Guid evaluatorId,
        int count,
        EvaluationScore? score = null,
        CancellationToken cancellationToken = default)
    {
        if (count <= 0) return [];

        var context = contextFactory();
        var recent = await ScanWindowQuery(context, 500).ToListAsync(cancellationToken);

        var matchingIds = recent
            .Where(r => r.Evaluations.Any(e =>
                e.EvaluatorId == evaluatorId && (score is null || e.Score == score)))
            .GroupBy(r => r.TestCase)
            .Select(g => g.First().Id)
            .Take(count)
            .ToList();

        return await LoadFullInOrderAsync(context, matchingIds, cancellationToken);
    }

    public async Task<IReadOnlyList<ITestResult>> SearchByEvaluatorAsync(
        Guid evaluatorId,
        string query,
        int count,
        CancellationToken cancellationToken = default)
    {
        if (count <= 0) return [];

        // Mirror GetRecentByEvaluatorAsync: scan a recent window and filter in memory so the
        // in-memory test provider behaves identically to PostgreSQL (no relational-only operators).
        var context = contextFactory();
        var recent = await ScanWindowQuery(context, 1000).ToListAsync(cancellationToken);

        var dedupedIds = recent
            .Where(r => r.Evaluations.Any(e => e.EvaluatorId == evaluatorId))
            .GroupBy(r => r.TestCase)
            .Select(g => g.First().Id)
            .Take(300)
            .ToList();
        if (dedupedIds.Count == 0) return [];

        // Load the deduped candidates' full rows once, then map+filter until count is reached.
        // Summary is computed by the domain entity, so the text filter runs after mapping.
        var byId = (await context
                .Set<TestResultEntity>()
                .AsNoTracking()
                .Where(r => dedupedIds.Contains(r.Id))
                .ToListAsync(cancellationToken))
            .ToDictionary(e => e.Id);

        var trimmed = query.Trim();
        var matches = new List<ITestResult>();
        foreach (var id in dedupedIds)
        {
            if (!byId.TryGetValue(id, out var entity)) continue;
            var mapped = await Map(entity, cancellationToken);
            if (mapped is null) continue;
            if (trimmed.Length > 0 && !MatchesQuery(mapped, evaluatorId, trimmed)) continue;
            matches.Add(mapped);
            if (matches.Count >= count) break;
        }
        return matches;
    }

    // Most-recent-N projection used by the evaluator-history scans. Reads only the columns the
    // evaluator/score filter needs — notably never the large ActualResponse payload column.
    private static IQueryable<EvaluatorScanRow> ScanWindowQuery(StorageDbContext context, int window)
        => context
            .Set<TestResultEntity>()
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Take(window)
            .Select(r => new EvaluatorScanRow(r.Id, r.TestCase, r.Evaluations));

    // Loads the full rows for the given ids and maps them, preserving the order of <paramref name="ids"/>.
    private async Task<IReadOnlyList<ITestResult>> LoadFullInOrderAsync(
        StorageDbContext context,
        IReadOnlyList<Guid> ids,
        CancellationToken cancellationToken)
    {
        if (ids.Count == 0) return [];

        var byId = (await context
                .Set<TestResultEntity>()
                .AsNoTracking()
                .Where(r => ids.Contains(r.Id))
                .ToListAsync(cancellationToken))
            .ToDictionary(e => e.Id);

        var mapped = new List<ITestResult>(ids.Count);
        foreach (var id in ids)
        {
            if (!byId.TryGetValue(id, out var entity)) continue;
            var m = await Map(entity, cancellationToken);
            if (m is not null) mapped.Add(m);
        }
        return mapped;
    }

    // Lightweight projection for the evaluator-history window scans (excludes ActualResponse).
    private sealed record EvaluatorScanRow(
        Guid Id,
        Guid TestCase,
        IReadOnlyCollection<StoredEvaluation> Evaluations);

    private static bool MatchesQuery(ITestResult result, Guid evaluatorId, string query)
    {
        if (result.TestCase.GetSummary().Contains(query, StringComparison.OrdinalIgnoreCase))
            return true;
        var reasoning = result.Evaluations
            .FirstOrDefault(e => e.Evaluator.Id == evaluatorId)?.Reasoning;
        return reasoning is not null && reasoning.Contains(query, StringComparison.OrdinalIgnoreCase);
    }
}
