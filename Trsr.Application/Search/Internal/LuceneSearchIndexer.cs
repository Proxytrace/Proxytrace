using Lucene.Net.Documents;
using Lucene.Net.Index;
using Lucene.Net.Search;
using Microsoft.Extensions.Logging;
using Trsr.Application.Search.Internal.Mappers;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal;

internal sealed class LuceneSearchIndexer : ISearchIndexer
{
    private readonly LuceneIndexWriter writer;
    private readonly IReadOnlyDictionary<SearchKind, IDocumentMapper> mappers;
    private readonly IReindexStateTracker reindexTracker;
    private readonly IProjectSearchSettingsResolver settingsResolver;
    private readonly ILogger<LuceneSearchIndexer> logger;

    public LuceneSearchIndexer(
        LuceneIndexWriter writer,
        IEnumerable<IDocumentMapper> mappers,
        IReindexStateTracker reindexTracker,
        IProjectSearchSettingsResolver settingsResolver,
        ILogger<LuceneSearchIndexer> logger)
    {
        this.writer = writer;
        this.mappers = mappers
            .GroupBy(m => m.Kind)
            .ToDictionary(g => g.Key, g => g.First());
        this.reindexTracker = reindexTracker;
        this.settingsResolver = settingsResolver;
        this.logger = logger;
    }

    public async Task IndexAsync(SearchKind kind, Guid projectId, Guid entityId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!mappers.TryGetValue(kind, out var mapper))
            {
                return;
            }
            var doc = await mapper.BuildAsync(entityId, cancellationToken);
            if (doc is null)
            {
                writer.Delete($"{kind}:{entityId}");
                return;
            }
            writer.Upsert($"{kind}:{entityId}", doc);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to index {Kind} {EntityId}", kind, entityId);
        }
    }

    public Task RemoveAsync(SearchKind kind, Guid entityId, CancellationToken cancellationToken = default)
    {
        try
        {
            writer.Delete($"{kind}:{entityId}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to remove {Kind} {EntityId}", kind, entityId);
        }
        return Task.CompletedTask;
    }

    public async Task ReindexProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        using var _ = reindexTracker.BeginReindex(projectId);

        var settings = await settingsResolver.GetOrDefaultsAsync(projectId, cancellationToken);
        var allowed = settings.IndexedKinds.ToHashSet();

        var projectFilter = new TermQuery(new Term(SearchConstants.FieldProjectId, projectId.ToString()));
        writer.DeleteByQuery(projectFilter);

        foreach (var (kind, mapper) in mappers)
        {
            if (!allowed.Contains(kind))
            {
                continue;
            }
            
            var docs = mapper.BuildAllForProjectAsync(projectId, cancellationToken);
            await foreach (Document doc in docs)
            {
                var id = doc.Get(SearchConstants.FieldId);
                writer.Upsert(id, doc);
            }
        }
    }
}
