using System.Security.Cryptography;
using System.Text;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Storage.Internal.Entities.Agent;

[UsedImplicitly]
internal class AgentRepository : AbstractRepository<IAgent, AgentEntity>, IAgentRepository
{
    private readonly IAgent.CreateNew createNew;

    public AgentRepository(
        IMapper<IAgent, AgentEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IAgent.CreateNew createNew) : base(mapper, contextFactory, transaction)
    {
        this.createNew = createNew;
    }

    public async Task<IAgent> GetOrCreateAsync(
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IProject project,
        CancellationToken cancellationToken = default)
    {
        var fingerprint = GetAgentFingerprint(systemMessage, tools);

        var existing = await contextFactory()
            .Set<AgentEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Fingerprint == fingerprint && e.Project == project.Id, cancellationToken);

        if (existing is not null)
        {
            return Map(existing);
        }

        var agent = createNew(systemMessage, tools, project.Id);
        return await AddAsync(agent, cancellationToken);
    }
    
    /// <summary>
    /// Computes a stable SHA-256 fingerprint from a system message and tool specifications.
    /// Two agents with the same system message text and the same tools (by name, description,
    /// and schema) will produce the same fingerprint.
    /// </summary>
    public string GetAgentFingerprint(SystemMessage systemMessage, IReadOnlyCollection<ToolSpecification> tools)
    {
        var sb = new StringBuilder();

        // System message: concatenate all text contents
        foreach (var content in systemMessage.Contents)
            sb.Append(content.Text ?? "");

        sb.Append('\0');

        // Tools: sort by name for stability, then append name + description + schema
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
        => GetAgentFingerprint(agent.SystemMessage, agent.Tools);
}
