using System.Text;
using Lucene.Net.Documents;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal.Mappers;

internal sealed class EvaluatorDocumentMapper : AbstractDocumentMapper<IEvaluator>
{
    public override SearchKind Kind => SearchKind.Evaluator;

    public EvaluatorDocumentMapper(IRepository<IEvaluator> repository) : base(repository)
    {
    }

    protected override Document? GetDocument(IEvaluator evaluator)
    {
        if (evaluator is not IAgenticEvaluator agenticEvaluator)
        {
            return null;
        }
        
        var body = new StringBuilder()
            .Append(agenticEvaluator.Agent.SystemPrompt.Name).Append('\n')
            .Append(agenticEvaluator.Agent.SystemPrompt.Template);

        var title = !string.IsNullOrEmpty(evaluator.Name)
            ? agenticEvaluator.Name
            : agenticEvaluator.Agent.SystemPrompt.Name;

        return DocumentBuilder.Build(
            kind: SearchKind.Evaluator,
            entityId: agenticEvaluator.Id,
            projectId: agenticEvaluator.Project.Id,
            createdAt: agenticEvaluator.CreatedAt,
            title: title,
            body: body.ToString(),
            boostedBody: title);
    }
}
