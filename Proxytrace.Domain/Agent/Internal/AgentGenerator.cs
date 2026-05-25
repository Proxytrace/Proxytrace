using Proxytrace.Common.Random;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;

namespace Proxytrace.Domain.Agent.Internal;

internal class AgentGenerator : DomainEntityGenerator<IAgent>, IAgentGenerator
{
    private readonly IAgent.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;
    private readonly IDomainEntityGenerator<IModelEndpoint> endpointGenerator;
    private readonly IDomainObjectGenerator<IPromptTemplate> promptTemplateGenerator;
    private readonly IPromptTemplate.Create createPrompt;
    private readonly IDomainObjectGenerator<IModelParameters> modelParametersGenerator;

    public AgentGenerator(
        IAgent.CreateNew factory,
        IRepository<IAgent> repository,
        IDomainEntityGenerator<IProject> projectGenerator,
        IDomainEntityGenerator<IModelEndpoint> endpointGenerator,
        IDomainObjectGenerator<IPromptTemplate> promptTemplateGenerator,
        IPromptTemplate.Create createPrompt,
        IDomainObjectGenerator<IModelParameters> modelParametersGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
        this.endpointGenerator = endpointGenerator;
        this.promptTemplateGenerator = promptTemplateGenerator;
        this.createPrompt = createPrompt;
        this.modelParametersGenerator = modelParametersGenerator;
    }

    public override async Task<IAgent> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        var endpoint = await endpointGenerator.GetOrCreateAsync(cancellationToken);
        var promptTemplate = await promptTemplateGenerator.CreateAsync(cancellationToken);
        var modelParameters = await modelParametersGenerator.CreateAsync(cancellationToken);

        return factory(
            name: random.String(),
            systemPrompt: promptTemplate,
            tools: [],
            endpoint: endpoint,
            project: project,
            modelParameters: modelParameters);
    }

    public async Task<IAgent> CreateAsync(
        string name,
        string? systemPrompt = null,
        bool isSystemAgent = false,
        CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        var endpoint = await endpointGenerator.GetOrCreateAsync(cancellationToken);
        var promptTemplate = systemPrompt != null 
            ? createPrompt(name, systemPrompt)
            : await promptTemplateGenerator.CreateAsync(cancellationToken);
        var modelParameters = await modelParametersGenerator.CreateAsync(cancellationToken);

        var agent = factory(
            name: random.String(),
            systemPrompt: promptTemplate,
            tools: [],
            endpoint: endpoint,
            project: project,
            modelParameters: modelParameters,
            isSystemAgent: isSystemAgent);
        return await agent.AddAsync(cancellationToken);
    }
}
