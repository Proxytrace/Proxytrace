using Lucene.Net.Documents;
using Proxytrace.Domain.Search;

namespace Proxytrace.Application.Search.Internal.Mappers;

internal interface IDocumentMapper
{
    SearchKind Kind { get; }
    Task<Document?> BuildAsync(Guid entityId, CancellationToken cancellationToken);
    IAsyncEnumerable<Document> BuildAllForProjectAsync(Guid projectId, CancellationToken cancellationToken);
}
