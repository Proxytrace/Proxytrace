namespace Proxytrace.Api.Dto.TestRuns;

public record TestCaseFixtureDto(
    TestCaseInputDto Input,
    OutputValueDto Expected,
    OutputValueDto Actual,
    EvaluatorFixtureResultDto[] Evaluators,
    RuntimeBreakdownDto Runtime,
    EndpointUsageDto[] Endpoints
);

public record TestCaseInputDto(TestCaseMessageDto[] Messages);

public record TestCaseMessageDto(string Role, string Content, string? Name);

public record OutputValueDto(
    string Kind,
    string? Content,
    ToolCallInfoDto? Tool,
    string? Name,
    object? Arguments
);

public record ToolCallInfoDto(string Name, object Arguments);

public record EvaluatorFixtureResultDto(
    string EvaluatorId,
    string EvaluatorKind,
    string EvaluatorName,
    double Score,
    bool Pass,
    BreakdownItemDto[] Breakdown,
    string Note
);

public record BreakdownItemDto(string K, string V, bool Match);

public record RuntimeBreakdownDto(long Total, long Ttft, long Gen, long Tools, long? Judge);

public record EndpointUsageDto(
    string Id,
    string Label,
    string Color,
    string Region,
    double PricingIn,
    double PricingOut,
    ulong? TokIn,
    ulong? TokOut,
    int Calls,
    long Latency,
    double CostUsd
);
