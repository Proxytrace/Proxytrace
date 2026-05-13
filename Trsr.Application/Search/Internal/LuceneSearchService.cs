using Lucene.Net.Analysis.Standard;
using Lucene.Net.Index;
using Lucene.Net.QueryParsers.Classic;
using Lucene.Net.Search;
using Lucene.Net.Search.Highlight;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal;

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
            parsed = parser.Parse(query);
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
            string snippet = string.Empty;
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
                snippet = bodyText.Length <= snippetMax
                    ? bodyText
                    : bodyText[..snippetMax];
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
}
