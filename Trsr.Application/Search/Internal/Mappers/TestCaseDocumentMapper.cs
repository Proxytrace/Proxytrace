using System.Text;
using Lucene.Net.Documents;
using Trsr.Domain;
using Trsr.Domain.Message;
using Trsr.Domain.Search;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestSuite;

namespace Trsr.Application.Search.Internal.Mappers;

/// <summary>
/// Indexes test cases for search. TestCase has no direct project reference, so we resolve the
/// owning project via the parent test suite. Live indexing requires ITestCase : ISearchable;
/// for now, indexing happens on full-project reindex.
/// </summary>
internal sealed class TestCaseDocumentMapper : IDocumentMapper
{
    private readonly IRepository<ITestCase> testCases;
    private readonly ITestSuiteRepository testSuites;

    public SearchKind Kind => SearchKind.TestCase;

    public TestCaseDocumentMapper(
        IRepository<ITestCase> testCases,
        ITestSuiteRepository testSuites)
    {
        this.testCases = testCases;
        this.testSuites = testSuites;
    }

    public async Task<Document?> BuildAsync(Guid entityId, CancellationToken cancellationToken)
    {
        var tc = await testCases.FindAsync(entityId, cancellationToken);
        if (tc is null) return null;

        // Locate parent suite to get project
        var allSuites = await testSuites.GetAllAsync(cancellationToken);
        var suite = allSuites.FirstOrDefault(s => s.TestCases.Any(c => c.Id == entityId));
        if (suite is null) return null;

        return BuildDocument(tc, suite);
    }

    public async Task<IReadOnlyList<Document>> BuildAllForProjectAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var suites = await testSuites.GetByProjectAsync(projectId, cancellationToken);
        var docs = new List<Document>();
        var seen = new HashSet<Guid>();
        foreach (var suite in suites)
        {
            foreach (var tc in suite.TestCases)
            {
                if (!seen.Add(tc.Id)) continue;
                docs.Add(BuildDocument(tc, suite));
            }
        }
        return docs;
    }

    private static Document BuildDocument(ITestCase tc, ITestSuite suite)
    {
        var body = new StringBuilder();
        foreach (var msg in tc.Input.Messages)
        {
            foreach (var content in msg.Contents)
            {
                if (!string.IsNullOrEmpty(content.Text)) body.Append(content.Text).Append('\n');
            }
        }
        foreach (var content in tc.ExpectedOutput.Contents)
        {
            if (!string.IsNullOrEmpty(content.Text)) body.Append(content.Text).Append('\n');
        }

        var firstUser = tc.Input.Messages
            .OfType<UserMessage>()
            .SelectMany(m => m.Contents)
            .Select(c => c.Text)
            .FirstOrDefault(t => !string.IsNullOrWhiteSpace(t)) ?? "";
        var preview = firstUser.Length > 60 ? firstUser[..60] + "…" : firstUser;
        var title = $"Test case · {suite.Name} · {preview}";

        return DocumentBuilder.Build(
            kind: SearchKind.TestCase,
            entityId: tc.Id,
            projectId: suite.Agent.Project.Id,
            createdAt: tc.CreatedAt,
            title: title,
            body: body.ToString(),
            boostedBody: suite.Name);
    }
}
