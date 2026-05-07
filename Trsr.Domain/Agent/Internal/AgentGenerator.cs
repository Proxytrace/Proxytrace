using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Agent.Internal;

internal class AgentGenerator : DomainEntityGenerator<IAgent>
{
    private readonly IAgent.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;
    private readonly IDomainEntityGenerator<IModelEndpoint> endpointGenerator;
    private readonly IDomainObjectGenerator<IPromptTemplate> promptTemplateGenerator;

    public AgentGenerator(
        IAgent.CreateNew factory,
        IRepository<IAgent> repository,
        IDomainEntityGenerator<IProject> projectGenerator,
        IDomainEntityGenerator<IModelEndpoint> endpointGenerator,
        IDomainObjectGenerator<IPromptTemplate> promptTemplateGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
        this.endpointGenerator = endpointGenerator;
        this.promptTemplateGenerator = promptTemplateGenerator;
    }

    public override async Task<IAgent> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        var endpoint = await endpointGenerator.GetOrCreateAsync(cancellationToken);
        var promptTemplate = await promptTemplateGenerator.CreateAsync(cancellationToken);
        
        return factory(
            name: random.String(),
            systemPrompt: promptTemplate,
            tools: [],
            endpoint: endpoint,
            project: project);
    }
}
