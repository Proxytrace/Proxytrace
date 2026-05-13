using System.Text;
using Lucene.Net.Documents;
using Microsoft.Extensions.Logging;
using Trsr.Domain;
using Trsr.Domain.Search;
using Trsr.Domain.TestSuite;

namespace Trsr.Application.Search.Internal.Mappers;

internal sealed class TestSuiteDocumentMapper : AbstractDocumentMapper<ITestSuite>
{
    public override SearchKind Kind => SearchKind.TestSuite;
    
    public TestSuiteDocumentMapper(
        IRepository<ITestSuite> repository,
        ILogger<TestSuiteDocumentMapper> logger) : base(repository, logger)
    {
    }
    
    protected override Document GetDocument(ITestSuite suite)
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
