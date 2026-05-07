using JetBrains.Annotations;
using Microsoft.Extensions.Logging;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Application.Agent;

[UsedImplicitly]
internal sealed class AgentNameGenerator : IAgentNameGenerator
{
    private const string PromptName = "agent_name_generator";

    private readonly IPromptTemplateRepository prompts;
    private readonly IAgentRepository agentRepository;
    private readonly ILogger<AgentNameGenerator> logger;

    public AgentNameGenerator(
        IPromptTemplateRepository prompts,
        IAgentRepository agentRepository,
        ILogger<AgentNameGenerator> logger)
    {
        this.prompts = prompts;
        this.agentRepository = agentRepository;
        this.logger = logger;
    }

    public async Task<string> GenerateNameAsync(
        IPromptTemplate promptTemplate,
        IProject project,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var agent = await GetGeneratorAgent(project, cancellationToken);
            var result = await agent
                .CreateClient()
                .CompleteAsync(
                    Message.CreateUserMessage(promptTemplate.Template),
                    cancellationToken: cancellationToken);
            return result.Response.GetTextResponse();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Agent name generation failed for project {ProjectId}", project.Id);
            throw;
        }
    }

    private async Task<IAgent> GetGeneratorAgent(IProject project, CancellationToken cancellationToken)
        => await agentRepository.GetOrCreateAsync(
            name: PromptName,
            systemPrompt: await prompts.GetAsync(PromptName, cancellationToken),
            project: project,
            endpoint: project.SystemEndpoint,
            tools: [],
            isSystemAgent: true,
            cancellationToken: cancellationToken);
}