using Lucene.Net.Documents;
using Trsr.Domain;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal.Mappers;

internal abstract class AbstractDocumentMapper<TDomainEntity> : IDocumentMapper 
    where TDomainEntity : class, IDomainEntity, ISearchable
{
    private readonly IRepository<TDomainEntity> repository;
    
    public abstract SearchKind Kind { get; }
    
    protected AbstractDocumentMapper(IRepository<TDomainEntity> repository)
    {
        this.repository = repository;
    }
    
    public async Task<Document?> BuildAsync(Guid entityId, CancellationToken cancellationToken)
    {
        var entity = await repository.FindAsync(entityId, cancellationToken);
        return entity is null ? null : GetDocument(entity);
    }

    public async Task<IReadOnlyList<Document>> BuildAllForProjectAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        return all
            .Where(s => s.Project.Id == projectId)
            .Select(GetDocument)
            .Where(doc => doc != null)
            .Cast<Document>()
            .ToList();
    }
    
    protected abstract Document? GetDocument(TDomainEntity entity);
}