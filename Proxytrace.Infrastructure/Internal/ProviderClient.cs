using System.ClientModel;
using System.Net.Http.Headers;
using System.Text.Json;
using OpenAI;
using OpenAI.Models;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Infrastructure.Internal;

internal sealed class ProviderClient : IProviderClient
{
    private const string AzureDeploymentsApiVersion = "2023-03-15-preview";

    private readonly IModelProvider provider;
    private readonly IModelRepository modelRepository;

    public ProviderClient(
        IModelProvider provider,
        IModelRepository modelRepository)
    {
        this.provider = provider;
        this.modelRepository = modelRepository;
    }

    public async Task<bool> VerifyConnectionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await GetModelsAsync(cancellationToken);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<IReadOnlyList<IModel>> GetModelsAsync(CancellationToken cancellationToken = default)
    {
        EnsureSupportedKind();

        IReadOnlyList<string>? deploymentIds = await TryGetAzureDeploymentNamesAsync(cancellationToken);
        IEnumerable<string> modelNames = deploymentIds is { Count: > 0 }
            ? deploymentIds
            : await GetOpenAiModelNamesAsync(cancellationToken);

        var models = new List<IModel>();
        foreach (var name in modelNames)
        {
            IModel model = await modelRepository.GetOrCreateAsync(name, cancellationToken);
            models.Add(model);
        }
        return models;
    }

    private async Task<IReadOnlyList<string>> GetOpenAiModelNamesAsync(CancellationToken cancellationToken)
    {
        try
        {
            OpenAIModelClient modelClient = CreateOpenAiClient();
            var result = (await modelClient.GetModelsAsync(cancellationToken))?.Value?.ToArray() ?? [];
            return result.Select(m => m.Id).ToArray();
        }
        catch
        {
            return [];
        }
    }

    private async Task<IReadOnlyList<string>?> TryGetAzureDeploymentNamesAsync(CancellationToken cancellationToken)
    {
        try
        {
            string basePath = StripOpenAiSuffix(provider.Endpoint.AbsolutePath);
            var builder = new UriBuilder(provider.Endpoint)
            {
                Path = $"{basePath}/openai/deployments",
                Query = $"api-version={AzureDeploymentsApiVersion}",
            };

            using var http = new HttpClient();
            using var request = new HttpRequestMessage(HttpMethod.Get, builder.Uri);
            request.Headers.Add("api-key", provider.ApiKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.ApiKey);

            using HttpResponseMessage response = await http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return null;

            await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using JsonDocument doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            if (!doc.RootElement.TryGetProperty("data", out JsonElement data) || data.ValueKind != JsonValueKind.Array)
                return null;

            var ids = new List<string>();
            foreach (JsonElement item in data.EnumerateArray())
            {
                if (item.TryGetProperty("id", out JsonElement idElement) && idElement.ValueKind == JsonValueKind.String)
                {
                    string? id = idElement.GetString();
                    if (!string.IsNullOrWhiteSpace(id))
                        ids.Add(id);
                }
            }
            return ids;
        }
        catch
        {
            return null;
        }
    }

    private static string StripOpenAiSuffix(string absolutePath)
    {
        string path = absolutePath.TrimEnd('/');
        if (path.EndsWith("/openai/v1", StringComparison.OrdinalIgnoreCase))
            path = path[..^"/openai/v1".Length];
        else if (path.EndsWith("/openai", StringComparison.OrdinalIgnoreCase))
            path = path[..^"/openai".Length];
        return path;
    }

    private OpenAIModelClient CreateOpenAiClient()
    {
        EnsureSupportedKind();
        var credential = new ApiKeyCredential(provider.ApiKey);
        var options = new OpenAIClientOptions { Endpoint = provider.Endpoint };
        return new OpenAIModelClient(credential, options);
    }

    private void EnsureSupportedKind()
    {
        if (provider.Kind is not ModelProviderKind.OpenAi and not ModelProviderKind.OpenAiCompatible)
            throw new NotSupportedException($"Model provider kind {provider.Kind} is not supported");
    }
}