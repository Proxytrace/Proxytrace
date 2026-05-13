using System.Text;
using Lucene.Net.Documents;
using Microsoft.Extensions.Logging;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal.Mappers;

internal sealed class AgentDocumentMapper : AbstractDocumentMapper<IAgent>
{
    public override SearchKind Kind => SearchKind.Agent;

    public AgentDocumentMapper(
        IRepository<IAgent> repository,
        ILogger<AgentCallDocumentMapper> logger) : base(repository, logger)
    {
    }
    
    protected override Document GetDocument(IAgent agent)
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
