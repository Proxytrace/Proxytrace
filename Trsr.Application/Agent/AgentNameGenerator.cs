using JetBrains.Annotations;
using Microsoft.Extensions.Logging;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Prompt;

namespace Trsr.Application.Agent;

[UsedImplicitly]
internal sealed class AgentNameGenerator : IAgentNameGenerator
{
    private const string PromptName = "agent_name_generator";

    private readonly IPromptTemplateRepository prompts;
    private readonly ILogger<AgentNameGenerator> logger;

    public AgentNameGenerator(
        IPromptTemplateRepository prompts,
        ILogger<AgentNameGenerator> logger)
    {
        this.prompts = prompts;
        this.logger = logger;
    }

    public async Task<string> GenerateNameAsync(
        IPromptTemplate promptTemplate,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        IPromptTemplate generatorPrompt = await prompts.GetAsync(PromptName, cancellationToken);
        try
        {
            var client = endpoint.CreateClient();

            var conversation = Conversation.Create();
            conversation.AddSystemMessage(Message.CreateSystemMessage(generatorPrompt));
            conversation.Add(Message.CreateUserMessage(promptTemplate.Template));
            
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
