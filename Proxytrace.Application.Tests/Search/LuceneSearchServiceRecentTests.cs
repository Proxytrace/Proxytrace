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
/// Guards the "recent" feed (the default empty-query state of the title-bar search): a high-volume
/// kind (traces) must not starve the low-volume kinds. Regression for issue #232, where the recent
/// feed degraded to traces-only once enough traces accumulated to fill the old shared top-N window.
/// </summary>
[TestClass]
public sealed class LuceneSearchServiceRecentTests
{
    public required TestContext TestContext { get; init; }

    private static readonly SearchKind[] AllKinds =
        [SearchKind.Agent, SearchKind.TestSuite, SearchKind.AgentCall, SearchKind.Evaluator];

    [TestMethod]
    public async Task GetRecent_WithFarMoreRecentTracesThanWindow_StillReturnsEveryOtherKind()
    {
        const int limit = 6;
        var projectId = Guid.NewGuid();
        var dir = new RAMDirectory();
        var writer = LuceneIndexWriter.ForTesting(dir);
        using (dir)
        using (writer)
        {
            var now = DateTimeOffset.UtcNow;

            // Far more recent traces than the old shared window (limit * kinds * 2 = 48) could hold,
            // and all newer than every non-trace entity — the exact condition that used to starve them.
            for (var i = 0; i < 60; i++)
                Index(writer, SearchKind.AgentCall, projectId, now.AddSeconds(-i));

            Index(writer, SearchKind.Agent, projectId, now.AddDays(-10));
            Index(writer, SearchKind.TestSuite, projectId, now.AddDays(-11));
            Index(writer, SearchKind.Evaluator, projectId, now.AddDays(-12));

            var service = BuildService(writer);

            var results = await service.GetRecentAsync(projectId, AllKinds, limit, TestContext.CancellationToken);

            var kinds = results.Hits.Select(h => h.Kind).ToHashSet();
            kinds.Should().Contain(SearchKind.Agent);
            kinds.Should().Contain(SearchKind.TestSuite);
            kinds.Should().Contain(SearchKind.Evaluator);
            kinds.Should().Contain(SearchKind.AgentCall);
        }
    }

    [TestMethod]
    public async Task GetRecent_CapsEachKindAtLimit()
    {
        const int limit = 3;
        var projectId = Guid.NewGuid();
        var dir = new RAMDirectory();
        var writer = LuceneIndexWriter.ForTesting(dir);
        using (dir)
        using (writer)
        {
            var now = DateTimeOffset.UtcNow;
            for (var i = 0; i < 10; i++)
                Index(writer, SearchKind.AgentCall, projectId, now.AddSeconds(-i));
            for (var i = 0; i < 10; i++)
                Index(writer, SearchKind.Agent, projectId, now.AddSeconds(-i));

            var service = BuildService(writer);

            var results = await service.GetRecentAsync(projectId, AllKinds, limit, TestContext.CancellationToken);

            results.Hits.Count(h => h.Kind == SearchKind.AgentCall).Should().Be(limit);
            results.Hits.Count(h => h.Kind == SearchKind.Agent).Should().Be(limit);
        }
    }

    [TestMethod]
    public async Task GetRecent_OnlyReturnsRequestedKinds()
    {
        const int limit = 5;
        var projectId = Guid.NewGuid();
        var dir = new RAMDirectory();
        var writer = LuceneIndexWriter.ForTesting(dir);
        using (dir)
        using (writer)
        {
            var now = DateTimeOffset.UtcNow;
            Index(writer, SearchKind.Agent, projectId, now);
            Index(writer, SearchKind.AgentCall, projectId, now);

            var service = BuildService(writer);

            var results = await service.GetRecentAsync(
                projectId, [SearchKind.Agent], limit, TestContext.CancellationToken);

            results.Hits.Should().OnlyContain(h => h.Kind == SearchKind.Agent);
        }
    }

    private static void Index(LuceneIndexWriter writer, SearchKind kind, Guid projectId, DateTimeOffset createdAt)
    {
        var entityId = Guid.NewGuid();
        var doc = DocumentBuilder.Build(
            kind: kind,
            entityId: entityId,
            projectId: projectId,
            createdAt: createdAt,
            title: $"{kind} {entityId.ToString()[..8]}",
            body: "body text",
            boostedBody: "boosted");
        writer.Upsert($"{kind}:{entityId}", doc);
    }

    private static LuceneSearchService BuildService(LuceneIndexWriter writer)
    {
        // GetRecentAsync does not consult project search settings, but the service ctor requires a
        // resolver — supply a permissive stub so construction succeeds.
        var settings = Substitute.For<IProjectSearchSettings>();
        settings.Enabled.Returns(true);
        settings.IndexedKinds.Returns(AllKinds);
        settings.SnippetLength.Returns(160);

        var resolver = Substitute.For<IProjectSearchSettingsResolver>();
        resolver.GetOrDefaultsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(settings));

        return new LuceneSearchService(writer, new SearchConfiguration(), resolver);
    }
}
