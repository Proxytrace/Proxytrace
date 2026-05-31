using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;

namespace Proxytrace.Application.Tracey.Internal;

internal sealed class TraceyAgentProvisioner : ITraceyAgentProvisioner
{
    private readonly ITraceyDefinition definition;
    private readonly IAgentRepository agents;
    private readonly IAgent.CreateNew createAgent;
    private readonly IPromptTemplate.Create createPrompt;
    private readonly IModelParameters.Create createParameters;

    public TraceyAgentProvisioner(
        ITraceyDefinition definition,
        IAgentRepository agents,
        IAgent.CreateNew createAgent,
        IPromptTemplate.Create createPrompt,
        IModelParameters.Create createParameters)
    {
        this.definition = definition;
        this.agents = agents;
        this.createAgent = createAgent;
        this.createPrompt = createPrompt;
        this.createParameters = createParameters;
    }

    public async Task<IAgent> EnsureTraceyAgentAsync(IProject project, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(project);

        var existing = await FindTraceyAgentAsync(project, cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var agent = createAgent(
            definition.Name,
            createPrompt("tracey-system", definition.SystemPrompt),
            tools: definition.Tools,
            endpoint: project.SystemEndpoint,
            project: project,
            modelParameters: createParameters(temperature: 0.2),
            isSystemAgent: true);

        return await agent.AddAsync(cancellationToken);
    }

    private async Task<IAgent?> FindTraceyAgentAsync(IProject project, CancellationToken cancellationToken)
    {
        await foreach (var agent in agents.EnumerateAsync(cancellationToken))
        {
            if (agent.IsSystemAgent
                && agent.Project.Id == project.Id
                && agent.Name == definition.Name)
            {
                return agent;
            }
        }

        return null;
    }
}
