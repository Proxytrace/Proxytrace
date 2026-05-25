using Proxytrace.Api.Dto.ApiKeys;
using Proxytrace.Api.Dto.Projects;

namespace Proxytrace.Api.Dto.ModelProviders;

/// <summary>
/// Single-call payload for the Providers page: every provider with its model endpoints and API
/// keys embedded, plus the projects available for scoping keys. Selecting a provider needs no
/// further request.
/// </summary>
public record ProvidersOverviewDto(
    IReadOnlyList<ProviderWithDetailsDto> Providers,
    IReadOnlyList<ProjectDto> Projects);

/// <summary>
/// A provider together with its configured model endpoints and issued API keys.
/// </summary>
public record ProviderWithDetailsDto(
    ModelProviderDto Provider,
    IReadOnlyList<ModelEndpointDto> Models,
    IReadOnlyList<ApiKeyDto> Keys);
