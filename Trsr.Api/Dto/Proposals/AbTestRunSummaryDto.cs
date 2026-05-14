using Trsr.Domain.TestRun;

namespace Trsr.Api.Dto.Proposals;

public record AbTestRunSummaryDto(
    Guid Id,
    Guid GroupId,
    TestRunStatus Status,
    int TotalCases,
    int CompletedCases,
    int PassedCases,
    int FailedCases,
    double PassRate,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    long? DurationMs);
