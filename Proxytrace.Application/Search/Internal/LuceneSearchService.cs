using System.Net;
using Lucene.Net.Analysis.Standard;
using Lucene.Net.Index;
using Lucene.Net.QueryParsers.Classic;
using Lucene.Net.Search;
using Lucene.Net.Search.Highlight;
using Proxytrace.Domain.Search;

namespace Proxytrace.Application.Search.Internal;

internal sealed class LuceneSearchService : ISearchService
{
    private readonly LuceneIndexWriter writer;
    private readonly SearchConfiguration configuration;
    private readonly IProjectSearchSettingsResolver settingsResolver;

    public LuceneSearchService(
        LuceneIndexWriter writer,
        SearchConfiguration configuration,
        IProjectSearchSettingsResolver settingsResolver)
    {
        this.writer = writer;
        this.configuration = configuration;
        this.settingsResolver = settingsResolver;
    }

    public async Task<SearchResults> SearchAsync(Guid projectId, string query, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return new SearchResults([]);
        }

        var settings = await settingsResolver.GetOrDefaultsAsync(projectId, cancellationToken);
        if (!settings.Enabled || settings.IndexedKinds.Count == 0)
        {
            return new SearchResults([]);
        }

        using var analyzer = new StandardAnalyzer(LuceneIndexWriter.Version);
        var parser = new MultiFieldQueryParser(
            LuceneIndexWriter.Version,
            [SearchConstants.FieldTitle, SearchConstants.FieldBody, SearchConstants.FieldBoostedBody],
            analyzer)
        {
            DefaultOperator = QueryParserBase.AND_OPERATOR,
            AllowLeadingWildcard = false,
        };

        Query parsed;
        try
        {
            parsed = parser.Parse(PrefixQueryRewriter.Rewrite(query));
        }
        catch (ParseException)
        {
            try
            {
                parsed = parser.Parse(QuerySanitizer.Escape(query));
            }
            catch (ParseException)
            {
                return new SearchResults([]);
            }
        }

        var combined = new BooleanQuery
        {
            { parsed, Occur.MUST },
            { new TermQuery(new Term(SearchConstants.FieldProjectId, projectId.ToString())), Occur.MUST },
        };

        var kindFilter = new BooleanQuery();
        foreach (var kind in settings.IndexedKinds)
        {
            kindFilter.Add(new TermQuery(new Term(SearchConstants.FieldKind, kind.ToString())), Occur.SHOULD);
        }
        combined.Add(kindFilter, Occur.MUST);

        using var reader = writer.AcquireReader();
        var searcher = reader.Searcher;

        int top = Math.Max(20, configuration.HitsPerKind * settings.IndexedKinds.Count * 4);
        var topDocs = searcher.Search(combined, top);

        int snippetMax = settings.SnippetLength;
        var formatter = new SimpleHTMLFormatter("<mark>", "</mark>");
        var scorer = new QueryScorer(parsed);
        var highlighter = new Highlighter(formatter, scorer)
        {
            TextFragmenter = new SimpleSpanFragmenter(scorer, snippetMax),
            // HTML-encode the body text while inserting <mark> tags so user/LLM content
            // (agent prompts, traces, test cases) can't inject markup into the snippet.
            // The default encoder is a no-op, which is the stored-XSS source.
            Encoder = new SimpleHTMLEncoder(),
        };

        var grouped = new Dictionary<SearchKind, List<SearchHit>>();
        foreach (var scoreDoc in topDocs.ScoreDocs)
        {
            var doc = searcher.Doc(scoreDoc.Doc);
            var kindStr = doc.Get(SearchConstants.FieldKind);
            if (!Enum.TryParse<SearchKind>(kindStr, out var kind))
            {
                continue;
            }

            if (!grouped.TryGetValue(kind, out var bucket))
            {
                bucket = [];
                grouped[kind] = bucket;
            }
            if (bucket.Count >= configuration.HitsPerKind)
            {
                continue;
            }

            string title = doc.Get(SearchConstants.FieldTitle) ?? string.Empty;
            string bodyText = doc.Get(SearchConstants.FieldBody) ?? string.Empty;
            string snippet;
            try
            {
                using var stream = analyzer.GetTokenStream(SearchConstants.FieldBody, bodyText);
                snippet = highlighter.GetBestFragment(stream, bodyText) ?? string.Empty;
            }
            catch
            {
                snippet = string.Empty;
            }
            if (string.IsNullOrEmpty(snippet))
            {
                // No highlight fragment: HTML-encode the raw body so it's safe to render.
                var fallback = bodyText.Length <= snippetMax ? bodyText : bodyText[..snippetMax];
                snippet = WebUtility.HtmlEncode(fallback);
            }

            var metadata = ParseMetadata(doc.Get(SearchConstants.FieldMetadata));
            bucket.Add(new SearchHit(
                Kind: kind,
                EntityId: Guid.Parse(doc.Get(SearchConstants.FieldEntityId)),
                Title: title,
                Snippet: snippet,
                Score: scoreDoc.Score,
                Metadata: metadata));
        }

        var ordered = new[] { SearchKind.Agent, SearchKind.TestSuite, SearchKind.AgentCall, SearchKind.Evaluator, SearchKind.TestCase }
            .SelectMany(k => grouped.TryGetValue(k, out var bucket) ? bucket : Enumerable.Empty<SearchHit>())
            .ToList();

        return new SearchResults(ordered);
    }

    public async Task<IReadOnlyList<Guid>> SearchEntityIdsAsync(
        Guid projectId,
        string query,
        SearchKind kind,
        int maxHits,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query) || maxHits <= 0)
        {
            return [];
        }

        var settings = await settingsResolver.GetOrDefaultsAsync(projectId, cancellationToken);
        if (!settings.Enabled || !settings.IndexedKinds.Contains(kind))
        {
            return [];
        }

        using var analyzer = new StandardAnalyzer(LuceneIndexWriter.Version);
        var parser = new MultiFieldQueryParser(
            LuceneIndexWriter.Version,
            [SearchConstants.FieldTitle, SearchConstants.FieldBody, SearchConstants.FieldBoostedBody],
            analyzer)
        {
            DefaultOperator = QueryParserBase.AND_OPERATOR,
            AllowLeadingWildcard = false,
        };

        Query parsed;
        try
        {
            parsed = parser.Parse(PrefixQueryRewriter.Rewrite(query));
        }
        catch (ParseException)
        {
            try
            {
                parsed = parser.Parse(QuerySanitizer.Escape(query));
            }
            catch (ParseException)
            {
                return [];
            }
        }

        var combined = new BooleanQuery
        {
            { parsed, Occur.MUST },
            { new TermQuery(new Term(SearchConstants.FieldProjectId, projectId.ToString())), Occur.MUST },
            { new TermQuery(new Term(SearchConstants.FieldKind, kind.ToString())), Occur.MUST },
        };

        using var reader = writer.AcquireReader();
        var searcher = reader.Searcher;

        var topDocs = searcher.Search(combined, maxHits);
        var ids = new List<Guid>(topDocs.ScoreDocs.Length);
        foreach (var scoreDoc in topDocs.ScoreDocs)
        {
            var doc = searcher.Doc(scoreDoc.Doc);
            var entityIdStr = doc.Get(SearchConstants.FieldEntityId);
            if (Guid.TryParse(entityIdStr, out var id))
            {
                ids.Add(id);
            }
        }
        return ids;
    }

    private static IReadOnlyDictionary<string, string> ParseMetadata(string? json)
    {
        if (string.IsNullOrEmpty(json))
        {
            return new Dictionary<string, string>();
        }
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var dict = new Dictionary<string, string>();
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                dict[prop.Name] = prop.Value.ToString();
            }
            return dict;
        }
        catch
        {
            return new Dictionary<string, string>();
        }
    }

    public Task<SearchResults> GetRecentAsync(
        Guid projectId,
        IReadOnlyList<SearchKind> kinds,
        int limit,
        CancellationToken cancellationToken = default)
    {
        if (limit <= 0 || kinds.Count == 0)
        {
            return Task.FromResult(new SearchResults([]));
        }

        var combined = new BooleanQuery
        {
            { new TermQuery(new Term(SearchConstants.FieldProjectId, projectId.ToString())), Occur.MUST },
        };

        var kindFilter = new BooleanQuery();
        foreach (var kind in kinds)
        {
            kindFilter.Add(new TermQuery(new Term(SearchConstants.FieldKind, kind.ToString())), Occur.SHOULD);
        }
        combined.Add(kindFilter, Occur.MUST);

        using var reader = writer.AcquireReader();
        var searcher = reader.Searcher;

        var sort = new Sort(new SortField(SearchConstants.FieldCreatedAt, SortFieldType.INT64, reverse: true));
        var perKind = new Dictionary<SearchKind, List<SearchHit>>();
        var fetched = 0;
        var pageSize = Math.Max(limit * kinds.Count * 2, 32);
        var topDocs = searcher.Search(combined, null, pageSize, sort);

        foreach (var scoreDoc in topDocs.ScoreDocs)
        {
            var doc = searcher.Doc(scoreDoc.Doc);
            if (!Enum.TryParse<SearchKind>(doc.Get(SearchConstants.FieldKind), out var kind))
            {
                continue;
            }
            if (!perKind.TryGetValue(kind, out var bucket))
            {
                bucket = [];
                perKind[kind] = bucket;
            }
            if (bucket.Count >= limit)
            {
                continue;
            }

            var entityIdStr = doc.Get(SearchConstants.FieldEntityId);
            if (!Guid.TryParse(entityIdStr, out var entityId))
            {
                continue;
            }

            bucket.Add(new SearchHit(
                Kind: kind,
                EntityId: entityId,
                Title: doc.Get(SearchConstants.FieldTitle) ?? string.Empty,
                Snippet: string.Empty,
                Score: 0f,
                Metadata: ParseMetadata(doc.Get(SearchConstants.FieldMetadata))));
            fetched++;
            if (fetched >= limit * kinds.Count)
            {
                break;
            }
        }

        var ordered = kinds
            .SelectMany(k => perKind.TryGetValue(k, out var bucket) ? bucket : Enumerable.Empty<SearchHit>())
            .ToList();
        return Task.FromResult(new SearchResults(ordered));
    }
}
