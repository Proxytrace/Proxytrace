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
    private readonly HttpClient http;
    private readonly IPricingService pricingService;

    public ProviderClient(
        IModelProvider provider,
        IModelRepository modelRepository,
        HttpClient http,
        IPricingService pricingService)
    {
        this.provider = provider;
        this.modelRepository = modelRepository;
        this.http = http;
        this.pricingService = pricingService;
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

    public async Task<IReadOnlyList<PricedModel>> GetModelsAsync(CancellationToken cancellationToken = default)
    {
        EnsureSupportedKind();

        IReadOnlyList<DiscoveredModel> discovered = await DiscoverAsync(cancellationToken);

        var result = new List<PricedModel>(discovered.Count);
        foreach (DiscoveredModel dm in discovered)
        {
            ModelPrice price = await pricingService.ResolveAsync(provider, dm, cancellationToken);
            IModel model = await modelRepository.GetOrCreateAsync(dm.Name, cancellationToken);
            result.Add(new PricedModel(model, price));
        }
        return result;
    }

    private async Task<IReadOnlyList<DiscoveredModel>> DiscoverAsync(CancellationToken cancellationToken)
    {
        if (ProviderEndpoints.IsAzure(provider.Endpoint))
        {
            // Azure: deployed models only; never fall back to the (far too large) /models list.
            return await GetAzureDeploymentsAsync(cancellationToken);
        }

        IReadOnlyList<string> names = await GetOpenAiModelNamesAsync(cancellationToken);
        return names.Select(n => new DiscoveredModel(n, n)).ToArray();
    }

    private async Task<IReadOnlyList<DiscoveredModel>> GetAzureDeploymentsAsync(CancellationToken cancellationToken)
    {
        try
        {
            string basePath = StripOpenAiSuffix(provider.Endpoint.AbsolutePath);
            var builder = new UriBuilder(provider.Endpoint)
            {
                Path = $"{basePath}/openai/deployments",
                Query = $"api-version={AzureDeploymentsApiVersion}",
            };

            using var request = new HttpRequestMessage(HttpMethod.Get, builder.Uri);
            request.Headers.Add("api-key", provider.ApiKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.ApiKey);

            using HttpResponseMessage response = await http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return [];

            await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using JsonDocument doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (!doc.RootElement.TryGetProperty("data", out JsonElement data) || data.ValueKind != JsonValueKind.Array)
                return [];

            var models = new List<DiscoveredModel>();
            foreach (JsonElement item in data.EnumerateArray())
            {
                string? id = item.TryGetProperty("id", out JsonElement idEl) && idEl.ValueKind == JsonValueKind.String
                    ? idEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(id))
                    continue;
                string baseModel = item.TryGetProperty("model", out JsonElement mEl) && mEl.ValueKind == JsonValueKind.String
                    ? mEl.GetString() ?? id : id;
                models.Add(new DiscoveredModel(id, baseModel));
            }
            return models;
        }
        catch
        {
            return [];
        }
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