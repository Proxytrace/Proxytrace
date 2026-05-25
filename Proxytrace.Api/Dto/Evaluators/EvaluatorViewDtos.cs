using Proxytrace.Api.Dto.Statistics;

namespace Proxytrace.Api.Dto.Evaluators;

/// <summary>
/// Single-call payload for the Evaluators list page: the evaluators, the suites they may be
/// attached to, and per-evaluator pass-rate sparklines. (Agentic presets stay a separate,
/// cacheable request.)
/// </summary>
public record EvaluatorsOverviewDto(
    IReadOnlyList<EvaluatorDetailDto> Evaluators,
    IReadOnlyList<EvaluatorSuiteRefDto> Suites,
    IReadOnlyList<EvaluatorSparklineDto> Sparklines);

/// <summary>
/// Lean test-suite reference used to compute which suites an evaluator is attached to.
/// </summary>
public record EvaluatorSuiteRefDto(
    Guid Id,
    string Name,
    string AgentName,
    IReadOnlyList<Guid> EvaluatorIds);

/// <summary>
/// Single-call payload for one evaluator's detail view: its statistics overview plus the
/// most recent evaluations table.
/// </summary>
public record EvaluatorDetailViewDto(
    EvaluatorOverviewDto Overview,
    IReadOnlyList<RecentEvaluationItemDto> RecentEvaluations);
