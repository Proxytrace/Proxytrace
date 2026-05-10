using Lucene.Net.Index;
using Lucene.Net.Search;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal;

internal sealed class LuceneSearchIndexStatistics : ISearchIndexStatistics
{
    private readonly LuceneIndexWriter writer;

    public LuceneSearchIndexStatistics(LuceneIndexWriter writer)
    {
        this.writer = writer;
    }

    public Task<int> CountAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var query = new TermQuery(new Term(SearchConstants.FieldProjectId, projectId.ToString()));
        using var reader = writer.AcquireReader();
        var top = reader.Searcher.Search(query, 1);
        return Task.FromResult(top.TotalHits);
    }

    public Task<DateTimeOffset?> LastIndexedAtAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var query = new TermQuery(new Term(SearchConstants.FieldProjectId, projectId.ToString()));
        var sort = new Sort(new SortField(SearchConstants.FieldCreatedAt, SortFieldType.INT64, reverse: true));

        using var reader = writer.AcquireReader();
        var top = reader.Searcher.Search(query, 1, sort);
        if (top.ScoreDocs.Length == 0)
        {
            return Task.FromResult<DateTimeOffset?>(null);
        }

        var doc = reader.Searcher.Doc(top.ScoreDocs[0].Doc);
        var field = doc.GetField(SearchConstants.FieldCreatedAt);
        if (field is null)
        {
            return Task.FromResult<DateTimeOffset?>(null);
        }

        long? ticks = field.GetInt64Value();
        if (ticks is null)
        {
            return Task.FromResult<DateTimeOffset?>(null);
        }
        return Task.FromResult<DateTimeOffset?>(new DateTimeOffset(ticks.Value, TimeSpan.Zero));
    }
}
