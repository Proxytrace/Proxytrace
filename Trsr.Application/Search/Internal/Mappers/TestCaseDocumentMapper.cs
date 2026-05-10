using Lucene.Net.Documents;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal.Mappers;

internal sealed class TestCaseDocumentMapper : IDocumentMapper
{
    public SearchKind Kind => SearchKind.TestCase;

    public Task<Document?> BuildAsync(Guid entityId, CancellationToken cancellationToken)
        => throw new NotImplementedException();

    public Task<IReadOnlyList<Document>> BuildAllForProjectAsync(Guid projectId, CancellationToken cancellationToken)
        => throw new NotImplementedException();
}
