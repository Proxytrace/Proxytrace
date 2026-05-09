using Trsr.Domain.ModelProvider;

namespace Trsr.Application.Setup;

public interface ISetupService
{
    Task<SetupResult> CompleteAsync(SetupInput input, CancellationToken cancellationToken = default);
}

public record SetupInput(
    string UserName,
    string ProviderName,
    Uri ProviderEndpoint,
    string ProviderUpstreamApiKey,
    ModelProviderKind ProviderKind,
    string ModelName,
    decimal? InputTokenCost,
    decimal? OutputTokenCost,
    string ProjectName,
    string ApiKeyName);

public record SetupResult(
    Guid UserId,
    Guid ProviderId,
    Guid EndpointId,
    Guid ProjectId,
    string ApiKeyValue);
