using System.Text.Json.Serialization;
using Proxytrace.Api.Dto.Agents;

namespace Proxytrace.Api.Dto.Proposals;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(ModelSwitchDetailsDto), "ModelSwitch")]
[JsonDerivedType(typeof(SystemPromptDetailsDto), "SystemPrompt")]
[JsonDerivedType(typeof(ToolDetailsDto), "Tool")]
[JsonDerivedType(typeof(ModelSwitchSeedDetailsDto), "ModelSwitchSeed")]
[JsonDerivedType(typeof(ToolUpdateSeedDetailsDto), "ToolUpdateSeed")]
public abstract record ProposalDetailsDto;

public record ModelSwitchDetailsDto(
    Guid EndpointId,
    string CurrentModelName,
    string ProposedModelName,
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

/// <summary>
/// Test-only seed input for a ModelSwitch proposal. Carries the proposed endpoint to switch to.
/// </summary>
public record ModelSwitchSeedDetailsDto(
    Guid ProposedEndpointId
) : ProposalDetailsDto;

/// <summary>
/// Test-only seed input for a ToolUpdate proposal. Carries the proposed tool set.
/// </summary>
public record ToolUpdateSeedDetailsDto(
    IReadOnlyList<SeedToolDto> ProposedTools
) : ProposalDetailsDto;

/// <summary>
/// Minimal tool definition for seeding a ToolUpdate proposal. <see cref="ParametersJson"/> is an
/// optional JSON schema for the tool's arguments; when omitted an empty schema is used.
/// </summary>
public record SeedToolDto(
    string Name,
    string Description,
    string? ParametersJson);
