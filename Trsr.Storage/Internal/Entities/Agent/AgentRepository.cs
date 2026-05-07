using System.Security.Cryptography;
using System.Text;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Tools;

namespace Trsr.Storage.Internal.Entities.Agent;

[UsedImplicitly]
internal class AgentRepository : AbstractRepository<IAgent, AgentEntity>, IAgentRepository
{
    private readonly IAgent.CreateNew createNew;
    private readonly IPromptTemplate.Create promptTemplateFactory;
    private readonly IAgentNameGenerator nameGenerator;

    public AgentRepository(
        IMapper<IAgent, AgentEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IAgent.CreateNew createNew,
        IPromptTemplate.Create promptTemplateFactory,
        IAgentNameGenerator nameGenerator) : base(mapper, contextFactory, transaction)
    {
        this.createNew = createNew;
        this.promptTemplateFactory = promptTemplateFactory;
        this.nameGenerator = nameGenerator;
    }

    public async Task<IAgent> GetOrCreateAsync(
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IProject project,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        var fingerprint = GetAgentFingerprint(systemPrompt, tools);

        var existing = await contextFactory()
            .Set<AgentEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Fingerprint == fingerprint && e.Project == project.Id, cancellationToken);

        if (existing is not null)
        {
            return await mapper.Map(existing, cancellationToken);
        }

        var name = await nameGenerator.GenerateNameAsync(systemPrompt, endpoint, cancellationToken);
        systemPrompt = promptTemplateFactory(name, systemPrompt.Template);
        var agent = createNew(
            name,
            systemPrompt,
            tools,
            endpoint,
            project);
        return await AddAsync(agent, cancellationToken);
    }

    public string GetAgentFingerprint(
        IPromptTemplate systemPrompt,
        IReadOnlyCollection<ToolSpecification> tools)
    {
        var sb = new StringBuilder();
        sb.Append(systemPrompt.Template).Append('\0');
        sb.Append('\0');

        foreach (var tool in tools.OrderBy(t => t.Name, StringComparer.Ordinal))
        {
            sb.Append(tool.Name).Append('\0');
            sb.Append(tool.Description).Append('\0');
            sb.Append(tool.Arguments.JsonSchema).Append('\0');
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public string GetAgentFingerprint(IAgent agent)
        => GetAgentFingerprint(agent.SystemPrompt, agent.Tools);
}
