using Proxytrace.Api.Dto.ApiKeys;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Api.Dto.ModelProviders;

/// <summary>
/// Maps <see cref="IModelProvider"/>, <see cref="IModelEndpoint"/>, and <see cref="IApiKey"/>
/// domain entities to their DTOs for the providers controller and aggregate views.
/// </summary>
public sealed class ModelProviderDtoMapper
{
    public ModelProviderDto ToDto(IModelProvider p) =>
        new(p.Id, p.Name, p.Endpoint.ToString(), p.ApiKey, p.Kind, p.CreatedAt, p.UpdatedAt);

    public ApiKeyDto ToKeyDto(IApiKey k) =>
        new(k.Id, k.Name, k.ApiKey, k.Project.Id, k.Project.Name, k.Provider.Id, k.Provider.Name, k.CreatedAt);

    public ModelEndpointDto ToEndpointDto(IModelEndpoint e) =>
        new(e.Id, e.Model.Name, e.Provider.Id, e.Provider.Name, e.InputTokenCost, e.OutputTokenCost, e.CreatedAt, e.UpdatedAt);
}
