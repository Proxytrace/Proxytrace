using System.Text;
using Lucene.Net.Documents;
using Trsr.Domain;
using Trsr.Domain.Search;
using Trsr.Domain.TestSuite;

namespace Trsr.Application.Search.Internal.Mappers;

internal sealed class TestSuiteDocumentMapper : IDocumentMapper
{
    private readonly IRepository<ITestSuite> repository;

    public TestSuiteDocumentMapper(IRepository<ITestSuite> repository)
    {
        this.repository = repository;
    }

    public SearchKind Kind => SearchKind.TestSuite;

    public async Task<Document?> BuildAsync(Guid entityId, CancellationToken cancellationToken)
    {
        ITestSuite? suite = await repository.FindAsync(entityId, cancellationToken);
        return suite is null ? null : Build(suite);
    }

    public async Task<IReadOnlyList<Document>> BuildAllForProjectAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        return all
            .Where(s => s.Agent.Project.Id == projectId)
            .Select(Build)
            .ToList();
    }

    private static Document Build(ITestSuite suite)
    {
        var body = new StringBuilder();
        foreach (var tc in suite.TestCases)
        {
            foreach (var msg in tc.Input.Messages)
            {
                foreach (var content in msg.Contents)
                {
                    if (!string.IsNullOrEmpty(content.Text))
                    {
                        body.Append(content.Text).Append('\n');
                    }
                }
            }
            foreach (var content in tc.ExpectedOutput.Contents)
            {
                if (!string.IsNullOrEmpty(content.Text))
                {
                    body.Append(content.Text).Append('\n');
                }
            }
        }

        return DocumentBuilder.Build(
            kind: SearchKind.TestSuite,
            entityId: suite.Id,
            projectId: suite.Agent.Project.Id,
            createdAt: suite.CreatedAt,
            title: suite.Name,
            body: body.ToString(),
            boostedBody: suite.Name);
    }
}
