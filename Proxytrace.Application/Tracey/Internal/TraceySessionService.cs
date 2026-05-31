using Microsoft.Extensions.Configuration;
using Proxytrace.Common.Random;
using Proxytrace.Common.Text;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.Project;

namespace Proxytrace.Application.Tracey.Internal;

internal sealed class TraceySessionService : ITraceySessionService
{
    private const string DefaultProxyBaseUrl = "http://localhost:5002";

    private readonly ITraceyAgentProvisioner provisioner;
    private readonly IApiKey.CreateNew createApiKey;
    private readonly IApiKeyRepository apiKeys;
    private readonly IRandom random;
    private readonly string proxyBaseUrl;

    public TraceySessionService(
        ITraceyAgentProvisioner provisioner,
        IApiKey.CreateNew createApiKey,
        IApiKeyRepository apiKeys,
        IRandom random,
        IConfiguration configuration)
    {
        this.provisioner = provisioner;
        this.createApiKey = createApiKey;
        this.apiKeys = apiKeys;
        this.random = random;
        proxyBaseUrl = (configuration["Tracey:ProxyBaseUrl"] ?? DefaultProxyBaseUrl).TrimEnd('/');
    }

    public async Task<TraceySessionResult> CreateSessionAsync(IProject project, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(project);

        var traceyAgent = await provisioner.EnsureTraceyAgentAsync(project, cancellationToken);

        var key = createApiKey(
            name: "tracey-session",
            apiKey: $"proxytrace-tracey-{random.UniqueString()}",
            project: project,
            provider: project.SystemEndpoint.Provider,
            expiresAt: DateTimeOffset.UtcNow.AddHours(1));
        var savedKey = await apiKeys.AddAsync(key, cancellationToken);

        var scopedBaseUrl = $"{proxyBaseUrl}/{project.Name.ToSlug()}/openai/v1";

        return new TraceySessionResult(
            ApiKey: savedKey.ApiKey,
            ProxyBaseUrl: scopedBaseUrl,
            Model: project.SystemEndpoint.Model.Name,
            AgentId: traceyAgent.Id);
    }
}
