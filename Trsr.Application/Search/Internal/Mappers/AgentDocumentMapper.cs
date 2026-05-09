using System.Text;
using Lucene.Net.Documents;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal.Mappers;

internal sealed class AgentDocumentMapper : IDocumentMapper
{
    private readonly IRepository<IAgent> repository;

    public AgentDocumentMapper(IRepository<IAgent> repository)
    {
        this.repository = repository;
    }

    public SearchKind Kind => SearchKind.Agent;

    public async Task<Document?> BuildAsync(Guid entityId, CancellationToken cancellationToken)
    {
        IAgent? agent = await repository.FindAsync(entityId, cancellationToken);
        return agent is null ? null : Build(agent);
    }

    public async Task<IReadOnlyList<Document>> BuildAllForProjectAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        return all
            .Where(a => a.Project.Id == projectId)
            .Select(Build)
            .ToList();
    }

    private static Document Build(IAgent agent)
    {
        var body = new StringBuilder()
            .Append(agent.SystemPrompt.Name).Append('\n')
            .Append(agent.SystemPrompt.Template).Append('\n');
        var boosted = new StringBuilder().Append(agent.Name);
        foreach (var tool in agent.Tools)
        {
            boosted.Append(' ').Append(tool.Name);
            body.Append(tool.Name).Append('\n').Append(tool.Description).Append('\n');
        }

        return DocumentBuilder.Build(
            kind: SearchKind.Agent,
            entityId: agent.Id,
            projectId: agent.Project.Id,
            createdAt: agent.CreatedAt,
            title: agent.Name,
            body: body.ToString(),
            boostedBody: boosted.ToString());
    }
}
