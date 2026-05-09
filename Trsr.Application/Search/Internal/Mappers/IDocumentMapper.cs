using Lucene.Net.Documents;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal.Mappers;

internal interface IDocumentMapper
{
    SearchKind Kind { get; }
    Task<Document?> BuildAsync(Guid entityId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Document>> BuildAllForProjectAsync(Guid projectId, CancellationToken cancellationToken);
}
