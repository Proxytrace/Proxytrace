using System.ClientModel;
using OpenAI;
using OpenAI.Models;
using Trsr.Domain.Model;
using Trsr.Domain.ModelProvider;

namespace Trsr.Infrastructure.Internal;

internal sealed class ProviderClient : IProviderClient
{
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
        OpenAIModelClient modelClient = CreateOpenAiClient();

        var models = new List<IModel>();
        ClientResult<OpenAIModelCollection> result = await modelClient.GetModelsAsync(cancellationToken);
        foreach (var modelInfo in result.Value)
        {
            IModel model = await modelRepository.GetOrCreateAsync(modelInfo.Id, cancellationToken);
            models.Add(model);
        }

        return models;
    }

    private OpenAIModelClient CreateOpenAiClient()
    {
        if (provider.Kind is not ModelProviderKind.OpenAi and not ModelProviderKind.OpenAiCompatible)
        {
            throw new NotSupportedException($"Model provider kind {provider.Kind} is not supported");
        }

        var credential = new ApiKeyCredential(provider.ApiKey);
        var options = new OpenAIClientOptions { Endpoint = provider.Endpoint };
        return new OpenAIModelClient(credential, options);
    }
}