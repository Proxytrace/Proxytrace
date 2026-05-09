using System.Text;
using Lucene.Net.Documents;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal.Mappers;

internal sealed class EvaluatorDocumentMapper : IDocumentMapper
{
    private readonly IRepository<IEvaluator> repository;

    public EvaluatorDocumentMapper(IRepository<IEvaluator> repository)
    {
        this.repository = repository;
    }

    public SearchKind Kind => SearchKind.Evaluator;

    public async Task<Document?> BuildAsync(Guid entityId, CancellationToken cancellationToken)
    {
        IEvaluator? evaluator = await repository.FindAsync(entityId, cancellationToken);
        return evaluator is ICustomEvaluator custom ? Build(custom) : null;
    }

    public async Task<IReadOnlyList<Document>> BuildAllForProjectAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        return all
            .OfType<ICustomEvaluator>()
            .Where(e => e.Project.Id == projectId)
            .Select(Build)
            .ToList();
    }

    private static Document Build(ICustomEvaluator evaluator)
    {
        var body = new StringBuilder()
            .Append(evaluator.SystemPrompt.Name).Append('\n')
            .Append(evaluator.SystemPrompt.Template);

        var title = !string.IsNullOrEmpty(evaluator.Name)
            ? evaluator.Name
            : evaluator.SystemPrompt.Name ?? "Custom Evaluator";

        return DocumentBuilder.Build(
            kind: SearchKind.Evaluator,
            entityId: evaluator.Id,
            projectId: evaluator.Project.Id,
            createdAt: evaluator.CreatedAt,
            title: title,
            body: body.ToString(),
            boostedBody: title);
    }
}
