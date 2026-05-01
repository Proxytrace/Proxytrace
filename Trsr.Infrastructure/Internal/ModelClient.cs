using System.ClientModel;
using Microsoft.Extensions.AI;
using OpenAI;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;

namespace Trsr.Infrastructure.Internal;

internal class ModelClient : IModelClient
{
    private readonly IModelEndpoint endpoint;
    private readonly IChatClient chatClient;
    
    public ModelClient(IModelEndpoint endpoint)
    {
        this.endpoint = endpoint;
        
        chatClient = CreateChatClient();
    }
    
    public async Task<AssistantMessage> CompleteAsync(
        Conversation conversation,
        ModelOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        options ??= ModelOptions.FromModel(endpoint.Model);
        
        if (options.Tools.Any())
        {
            throw new NotSupportedException("Tool support is not implemented yet");
        }
        
        // 1. Build ChatMessage list from SystemMessage and Conversation
        var chatMessages = conversation.ToChatMessages();
            
        // 2. Set chat options with model name
        var chatOptions = new ChatOptions()
        {
            ModelId = options.ModelName
        };
        
        // 3. Call the chat client
        ChatResponse response = await chatClient.GetResponseAsync(
            chatMessages,
            chatOptions,
            cancellationToken);
        
        // 4. Parse response into AssistantMessage
        var responseContents = new List<Content>
        {
            // Extract text content from response
            !string.IsNullOrWhiteSpace(response.Text)
                ? Content.FromText(response.Text)
                : Content.FromText("No response from model")
        };

        return Message.CreateAssistantMessage(
            contents: responseContents,
            toolRequests: []);
    }
    
    private IChatClient CreateChatClient()
    {
        if (endpoint.Provider.Kind is not ModelProviderKind.OpenAi and not ModelProviderKind.OpenAiCompatible)
        {
            throw new NotSupportedException($"Model provider kind {endpoint.Provider.Kind} is not supported");
        }
        
        var credential = new ApiKeyCredential(endpoint.Provider.ApiKey);
        var options = new OpenAIClientOptions { Endpoint = endpoint.Provider.Endpoint };
        return new OpenAIClient(credential, options)
            .GetChatClient(endpoint.Model.Name)
            .AsIChatClient();
    }
}