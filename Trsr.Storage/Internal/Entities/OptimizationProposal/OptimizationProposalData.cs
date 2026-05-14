using Trsr.Domain.Tools;

namespace Trsr.Storage.Internal.Entities.OptimizationProposal;

internal sealed record ModelSwitchProposalData(
    Guid ProposedEndpointId,
    double? ExpectedPassRateDelta,
    decimal? ExpectedCostDelta,
    TimeSpan? ExpectedLatencyDelta);

internal sealed record SystemPromptProposalData(string ProposedSystemMessage);

internal sealed record ToolUpdateProposalData(IReadOnlyList<ToolSpecification> ProposedTools);
