using Lucene.Net.Analysis.Standard;
using Lucene.Net.Documents;
using Lucene.Net.Index;
using Lucene.Net.Search;
using Lucene.Net.Util;

namespace Proxytrace.Application.Search.Internal;

internal sealed class LuceneIndexWriter : IDisposable
{
    public const LuceneVersion Version = LuceneVersion.LUCENE_48;

    private readonly Lucene.Net.Store.Directory directory;
    private readonly bool ownsDirectory;
    private readonly IndexWriter writer;
    private readonly SearcherManager searcherManager;
    private readonly Lock commitLock = new();

    public LuceneIndexWriter(ILuceneDirectoryFactory factory) : this(factory.Open(), ownsDirectory: true)
    {
    }

    private LuceneIndexWriter(Lucene.Net.Store.Directory directory, bool ownsDirectory)
    {
        this.directory = directory;
        this.ownsDirectory = ownsDirectory;
        var analyzer = new StandardAnalyzer(Version);
        var config = new IndexWriterConfig(Version, analyzer)
        {
            OpenMode = OpenMode.CREATE_OR_APPEND,
        };
        writer = new IndexWriter(directory, config);
        writer.Commit();
        searcherManager = new SearcherManager(writer, applyAllDeletes: true, null);
    }

    internal static LuceneIndexWriter ForTesting(Lucene.Net.Store.Directory directory)
        => new(directory, ownsDirectory: false);

    public void Upsert(string id, Document doc)
    {
        lock (commitLock)
        {
            writer.UpdateDocument(new Term(SearchConstants.FieldId, id), doc);
            writer.Commit();
            searcherManager.MaybeRefresh();
        }
    }

    public void Delete(string id)
    {
        lock (commitLock)
        {
            writer.DeleteDocuments(new Term(SearchConstants.FieldId, id));
            writer.Commit();
            searcherManager.MaybeRefresh();
        }
    }

    public void DeleteByQuery(Query query)
    {
        lock (commitLock)
        {
            writer.DeleteDocuments(query);
            writer.Commit();
            searcherManager.MaybeRefresh();
        }
    }

    public void UpsertDeferred(string id, Document doc)
    {
        lock (commitLock)
        {
            writer.UpdateDocument(new Term(SearchConstants.FieldId, id), doc);
        }
    }

    public void DeleteDeferred(string id)
    {
        lock (commitLock)
        {
            writer.DeleteDocuments(new Term(SearchConstants.FieldId, id));
        }
    }

    public void CommitAndRefresh()
    {
        lock (commitLock)
        {
            writer.Commit();
            searcherManager.MaybeRefresh();
        }
    }

    public AcquiredReader AcquireReader()
    {
        lock (commitLock)
        {
            searcherManager.MaybeRefresh();
            var searcher = searcherManager.Acquire();
            return new AcquiredReader(searcherManager, searcher);
        }
    }

    public void Dispose()
    {
        searcherManager.Dispose();
        writer.Dispose();
        if (ownsDirectory)
        {
            directory.Dispose();
        }
    }

    internal sealed class AcquiredReader : IDisposable
    {
        private readonly SearcherManager manager;
        private readonly IndexSearcher searcher;

        public AcquiredReader(SearcherManager manager, IndexSearcher searcher)
        {
            this.manager = manager;
            this.searcher = searcher;
        }

        public IndexSearcher Searcher => searcher;
        public IndexReader IndexReader => searcher.IndexReader;

        public void Dispose() => manager.Release(searcher);
    }
}