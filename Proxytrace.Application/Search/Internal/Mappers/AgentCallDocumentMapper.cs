using System.Text;
using System.Text.Json;
using Lucene.Net.Documents;
using Microsoft.Extensions.Logging;
using Proxytrace.Domain;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Search;

namespace Proxytrace.Application.Search.Internal.Mappers;

internal sealed class AgentCallDocumentMapper : AbstractDocumentMapper<IAgentCall>
{
    public override SearchKind Kind => SearchKind.AgentCall;
    
    public AgentCallDocumentMapper(
        IRepository<IAgentCall> repository,
        ILogger<AgentCallDocumentMapper> logger) : base(repository, logger)
    {
    }

    protected override Document GetDocument(IAgentCall call)
    {
        var body = new StringBuilder();

        foreach (var msg in call.Request.Messages)
        {
            foreach (var content in msg.Contents)
            {
                if (!string.IsNullOrEmpty(content.Text))
                {
                    body.Append(content.Text).Append('\n');
                }
            }
        }
        if (call.Response is not null)
        {
            foreach (var content in call.Response.Response.Contents)
            {
                if (!string.IsNullOrEmpty(content.Text))
                {
                    body.Append(content.Text).Append('\n');
                }
            }
        }
        if (!string.IsNullOrEmpty(call.ErrorMessage))
        {
            body.Append(call.ErrorMessage);
        }

        var shortId = call.Id.ToString("N").Substring(0, 8);
        var title = $"Trace {shortId} · {call.Agent.Name} · {call.CreatedAt:yyyy-MM-dd HH:mm}";

        var metadata = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["agentId"] = call.Agent.Id.ToString(),
            ["timestamp"] = call.CreatedAt.ToString("O"),
        });

        return DocumentBuilder.Build(
            kind: SearchKind.AgentCall,
            entityId: call.Id,
            projectId: call.Agent.Project.Id,
            createdAt: call.CreatedAt,
            title: title,
            body: body.ToString(),
            boostedBody: call.Agent.Name,
            metadataJson: metadata);
    }
}
