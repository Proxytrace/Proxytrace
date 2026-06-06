using AwesomeAssertions;
using Lucene.Net.Store;
using NSubstitute;
using Directory = Lucene.Net.Store.Directory;
using Proxytrace.Application.Search;
using Proxytrace.Application.Search.Internal;
using Proxytrace.Application.Search.Internal.Mappers;
using Proxytrace.Domain.ProjectSearchSettings;
using Proxytrace.Domain.Search;

namespace Proxytrace.Application.Tests.Search;

/// <summary>
/// Guards that captured-trace content is matched as a substring (mid-token fragment), not
/// only as a prefix — the regression behind the "content filter misses content" report.
/// </summary>
[TestClass]
public sealed class LuceneSearchServiceSubstringTests
{
    public required TestContext TestContext { get; init; }

    [TestMethod]
    public async Task SearchEntityIds_InteriorContentFragment_MatchesDocument()
    {
        var (entityId, projectId, service, dir, writer) = BuildIndexedTrace("the refund policy details");
        using (dir)
        using (writer)
        {
            // "efund" is an interior fragment of the indexed token "refund": prefix-only
            // matching ("efund*") would miss it; substring matching ("*efund*") finds it.
            var ids = await service.SearchEntityIdsAsync(
                projectId, "efund", SearchKind.AgentCall, 10, TestContext.CancellationToken);

            ids.Should().ContainSingle().Which.Should().Be(entityId);
        }
    }

    [TestMethod]
    public async Task SearchEntityIds_PrefixFragment_StillMatches()
    {
        var (entityId, projectId, service, dir, writer) = BuildIndexedTrace("the refund policy details");
        using (dir)
        using (writer)
        {
            var ids = await service.SearchEntityIdsAsync(
                projectId, "refun", SearchKind.AgentCall, 10, TestContext.CancellationToken);

            ids.Should().ContainSingle().Which.Should().Be(entityId);
        }
    }

    [TestMethod]
    public async Task SearchEntityIds_FragmentNotInContent_ReturnsEmpty()
    {
        var (_, projectId, service, dir, writer) = BuildIndexedTrace("the refund policy details");
        using (dir)
        using (writer)
        {
            var ids = await service.SearchEntityIdsAsync(
                projectId, "invoice", SearchKind.AgentCall, 10, TestContext.CancellationToken);

            ids.Should().BeEmpty();
        }
    }

    private static (Guid EntityId, Guid ProjectId, LuceneSearchService Service, Directory Dir, LuceneIndexWriter Writer)
        BuildIndexedTrace(string body)
    {
        var entityId = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        var settings = Substitute.For<IProjectSearchSettings>();
        settings.Enabled.Returns(true);
        settings.IndexedKinds.Returns([SearchKind.AgentCall]);
        settings.SnippetLength.Returns(160);

        var resolver = Substitute.For<IProjectSearchSettingsResolver>();
        resolver.GetOrDefaultsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(settings));

        var dir = new RAMDirectory();
        var writer = LuceneIndexWriter.ForTesting(dir);
        var doc = DocumentBuilder.Build(
            kind: SearchKind.AgentCall,
            entityId: entityId,
            projectId: projectId,
            createdAt: DateTimeOffset.UtcNow,
            title: "Trace 12345678",
            body: body,
            boostedBody: "Some Agent");
        writer.Upsert($"{SearchKind.AgentCall}:{entityId}", doc);

        var service = new LuceneSearchService(writer, new SearchConfiguration(), resolver);
        return (entityId, projectId, service, dir, writer);
    }
}
