using System.Security.Cryptography;
using System.Text;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Events;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Inference;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Tools;

namespace Trsr.Storage.Internal.Entities.Agent;

[UsedImplicitly]
internal class AgentRepository : AbstractRepository<IAgent, AgentEntity>, IAgentRepository
{
    private readonly IAgent.CreateNew createNew;
    private readonly IPromptTemplate.Create promptTemplateFactory;
    private readonly IModelParameters.Create modelParametersFactory;
    private readonly Lazy<IAgentNameGenerator> nameGenerator;
    private readonly IAsyncLock locker;

    public AgentRepository(
        IMapper<IAgent, AgentEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        IAgent.CreateNew createNew,
        IPromptTemplate.Create promptTemplateFactory,
        IModelParameters.Create modelParametersFactory,
        Lazy<IAgentNameGenerator> nameGenerator,
        IAsyncLock locker,
        IEntityCache<IAgent> cache) : base(mapper, contextFactory, transaction, entityEvents, cache)
    {
        this.createNew = createNew;
        this.promptTemplateFactory = promptTemplateFactory;
        this.modelParametersFactory = modelParametersFactory;
        this.nameGenerator = nameGenerator;
        this.locker = locker;
    }

    public async Task<IAgent> GetOrCreateAsync(
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IProject project,
        IModelEndpoint endpoint,
        string? name = null,
        bool isSystemAgent = false,
        IModelParameters? modelParameters = null,
        CancellationToken cancellationToken = default)
    {
        var fingerprint = GetAgentFingerprint(systemPrompt, tools);
        using IDisposable lockObj = await locker.LockAsync(fingerprint, cancellationToken);

        var existing = await FindByFingerprintAsync(fingerprint, project, cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        name ??= await nameGenerator.Value.GenerateNameAsync(systemPrompt, project, cancellationToken);
        systemPrompt = promptTemplateFactory(name, systemPrompt.Template);
        var agent = createNew(
            name: name,
            systemPrompt: systemPrompt,
            tools: tools,
            endpoint: endpoint,
            isSystemAgent: isSystemAgent,
            project: project,
            modelParameters: modelParameters ?? modelParametersFactory());

        try
        {
            return await AddAsync(agent, cancellationToken);
        }
        catch (DbUpdateException)
        {
            var raced = await FindByFingerprintAsync(fingerprint, project, cancellationToken);
            if (raced is not null)
            {
                return raced;
            }
            throw;
        }
    }

    private async Task<IAgent?> FindByFingerprintAsync(string fingerprint, IProject project, CancellationToken cancellationToken)
    {
        var existing = await ContextFactory()
            .Set<AgentEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Fingerprint == fingerprint && e.Project == project.Id, cancellationToken);
        return existing is null ? null : await Mapper.Map(existing, cancellationToken);
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
