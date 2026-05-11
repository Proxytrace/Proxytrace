using Trsr.Domain.ModelProvider;

namespace Trsr.Application.Setup;

public interface ISetupService
{
    Task<SetupResult> CompleteAsync(SetupInput input, CancellationToken cancellationToken = default);

    Task<bool> TestProviderConnectionAsync(ProviderConnectionInput input, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ListProviderModelsAsync(ProviderConnectionInput input, CancellationToken cancellationToken = default);

    Task<FirstAdminResult> CreateFirstAdminAsync(string email, string password, CancellationToken cancellationToken = default);

    Task<bool> AnyUsersExistAsync(CancellationToken cancellationToken = default);
}

public record ProviderConnectionInput(
    string ProviderName,
    Uri ProviderEndpoint,
    string ProviderUpstreamApiKey,
    ModelProviderKind ProviderKind);

public record SetupInput(
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
    Guid ProviderId,
    Guid EndpointId,
    Guid ProjectId,
    string ApiKeyValue);

public record FirstAdminResult(Guid UserId, string Token, DateTimeOffset ExpiresAt);
