using System.Text.Json.Serialization;
using Trsr.Api.Dto.Agents;

namespace Trsr.Api.Dto.Proposals;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(ModelSwitchDetailsDto), "ModelSwitch")]
[JsonDerivedType(typeof(SystemPromptDetailsDto), "SystemPrompt")]
[JsonDerivedType(typeof(ToolDetailsDto), "Tool")]
public abstract record ProposalDetailsDto;

public record ModelSwitchDetailsDto(
    Guid EndpointId,
    string CurrentModelName,
    string ProposedModelName,
    double? ExpectedPassRateDelta,
    double? ExpectedCostDelta,
    long? ExpectedLatencyMs
) : ProposalDetailsDto;

public record SystemPromptDetailsDto(
    string CurrentSystemMessage,
    string ProposedSystemMessage
) : ProposalDetailsDto;

public record ToolDetailsDto(
    IReadOnlyList<ToolSpecificationDto> CurrentTools,
    IReadOnlyList<ToolSpecificationDto> ProposedTools
) : ProposalDetailsDto;
