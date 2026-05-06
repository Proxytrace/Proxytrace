using JetBrains.Annotations;
using Microsoft.Extensions.Logging;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Application.Agent;

[UsedImplicitly]
internal sealed class AgentNameGenerator : IAgentNameGenerator
{
    private readonly ILogger<AgentNameGenerator> logger;

    public AgentNameGenerator(ILogger<AgentNameGenerator> logger)
    {
        this.logger = logger;
    }

    private const string Prompt =
        """
        You are a naming assistant. Given an AI agent's system message, respond with a short, descriptive name 
        (2-4 words, title case) that captures the agent's main purpose. Reply with the name only — no explanation, no punctuation, no quotes.
        """; 

    public async Task<string> GenerateNameAsync(
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var client = endpoint.CreateClient();

            var conversation = Conversation.Create();
            conversation.AddSystemMessage(Message.CreateSystemMessage(Prompt));
            conversation.Add(Message.CreateUserMessage(systemMessage.ToString()));
            
            var result = await client.CompleteAsync(conversation, cancellationToken: cancellationToken);
            return result.Response.GetTextResponse();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Agent name generation failed for endpoint {EndpointId}", endpoint.Id);
            throw;
        }
    }
}
