using Proxytrace.Domain.Evaluation;

namespace Proxytrace.Storage.Internal.Entities.TestResult;

/// <summary>
/// Query-optimized projection of a single evaluation into a queryable child row of
/// <see cref="TestResultEntity"/>. The authoritative copy of an evaluation stays in the
/// JSON-serialized <see cref="TestResultEntity.Evaluations"/> column; this row exists only so the
/// evaluator-scoped statistics queries (<c>EvaluatorStatsQueries</c>) can filter by
/// <see cref="EvaluatorId"/> and time <em>in SQL</em> instead of loading and deserializing every
/// test result in the window. Storage-only, no domain counterpart.
/// <para>
/// Populated at write time from <c>TestResultConfig.Map</c>. Like the AgentCall
/// <c>RequestPreview</c> denormalization, test results written before this table existed carry no
/// projection row and therefore do not appear in evaluator statistics until they age out via
/// retention.
/// </para>
/// </summary>
internal record EvaluationStatEntity
{
    public required Guid Id { get; init; }

    /// <summary>The owning <see cref="TestResultEntity"/>.</summary>
    public required Guid TestResultId { get; init; }

    public required Guid EvaluatorId { get; init; }

    /// <summary>
    /// Copied from the parent <see cref="TestResultEntity.CreatedAt"/> so the time-bucketed stats
    /// queries range and group on this row directly, with no join back to the result.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; init; }

    public EvaluationScore? Score { get; init; }

    /// <summary>True for an errored evaluation (no score); mirrors a non-null
    /// <c>StoredEvaluation.ErrorMessage</c>. The error text itself is not projected.</summary>
    public bool HasError { get; init; }

    public long? InputTokens { get; init; }
    public long? OutputTokens { get; init; }
    public long? CachedInputTokens { get; init; }
    public long LatencyMicroseconds { get; init; }
    public decimal? Cost { get; init; }
}
