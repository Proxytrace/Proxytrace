using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Domain.OptimizationProposal;

public abstract record ProposalDetails;

public record ModelSwitchDetails(
    Guid ProposedEndpointId,
    double? ExpectedPassRateDelta,
    decimal? ExpectedCostDelta,
    TimeSpan? ExpectedLatencyDelta
) : ProposalDetails;

public record SystemPromptDetails(
    string ProposedSystemMessage
) : ProposalDetails;

public record ToolDetails(
    IReadOnlyCollection<ToolSpecification> ProposedTools
) : ProposalDetails;
