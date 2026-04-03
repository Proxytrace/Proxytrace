using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Project;

namespace Trsr.Domain.Agent.Internal;

internal class AgentGenerator : DomainEntityGenerator<IAgent>
{
    private static readonly IReadOnlyCollection<string> Models = ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6"];
    private static readonly IReadOnlyCollection<string> Providers = ["openai", "anthropic"];

    private readonly IAgent.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;

    public AgentGenerator(
        IAgent.CreateNew factory,
        IRepository<IAgent> repository,
        IDomainEntityGenerator<IProject> projectGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
    }

    public override async Task<IAgent> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            systemMessage: new SystemMessage(random.String()),
            tools: [],
            model: random.Any(Models),
            provider: random.Any(Providers),
            project: project);
    }
}
