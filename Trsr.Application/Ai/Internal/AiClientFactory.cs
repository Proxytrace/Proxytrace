using JetBrains.Annotations;
using Microsoft.Extensions.AI;
using OpenAI;
using System.ClientModel;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;

namespace Trsr.Application.Ai.Internal;

[UsedImplicitly]
internal sealed class AiClientFactory : IAiClientFactory
{
    public IChatClient CreateClient(IModelEndpoint endpoint) 
        => endpoint.Provider.Kind switch
        {
            ModelProviderKind.OpenAi or ModelProviderKind.OpenAiCompatible
                => CreateOpenAiCompatibleClient(endpoint),
            ModelProviderKind.Anthropic 
                => throw new NotSupportedException($"Provider kind '{endpoint.Provider.Kind}' is not yet supported. Use an OpenAI-compatible endpoint."),
            _ 
                => throw new NotSupportedException($"Unknown provider kind '{endpoint.Provider.Kind}'.")
        };

    private static IChatClient CreateOpenAiCompatibleClient(IModelEndpoint endpoint)
    {
        var credential = new ApiKeyCredential(endpoint.Provider.ApiKey);
        var options = new OpenAIClientOptions { Endpoint = endpoint.Provider.Endpoint };
        return new OpenAIClient(credential, options)
            .GetChatClient(endpoint.Model.Name)
            .AsIChatClient();
    }
}
