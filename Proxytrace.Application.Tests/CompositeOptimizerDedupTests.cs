using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Application.Optimization.Internal;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class CompositeOptimizerDedupTests : BaseTest<Module>
{
    [TestMethod]
    public async Task FirstDiscovery_NoPriors_PersistsProposal()
    {
        Fixture f = await BuildAsync();
        SetPriors(f, []);

        var result = await f.Optimizer.DiscoverOptimizations(f.Group, CancellationToken);

        result.Should().HaveCount(1);
        await f.Proposals.Received(1).AddAsync(Arg.Any<IOptimizationProposal>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task DraftWithSameHash_Suppressed()
    {
        Fixture f = await BuildAsync();
        var draft = StubProposal(f.Agent, f.DiscoveredHash, ProposalStatus.Draft, DateTimeOffset.UtcNow);
        SetPriors(f, [draft]);

        var result = await f.Optimizer.DiscoverOptimizations(f.Group, CancellationToken);

        result.Should().BeEmpty();
        await f.Proposals.DidNotReceive().AddAsync(Arg.Any<IOptimizationProposal>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task RejectedWithSameHash_FewCompletedGroups_Suppressed()
    {
        Fixture f = await BuildAsync();
        var decidedAt = DateTimeOffset.UtcNow.AddDays(-1);
        SetPriors(f, [StubProposal(f.Agent, f.DiscoveredHash, ProposalStatus.Rejected, decidedAt)]);
        SetCompletedSince(f, 2);

        var result = await f.Optimizer.DiscoverOptimizations(f.Group, CancellationToken);

        result.Should().BeEmpty();
    }

    [TestMethod]
    public async Task AcceptedWithSameHash_FewCompletedGroups_Suppressed()
    {
        Fixture f = await BuildAsync();
        var decidedAt = DateTimeOffset.UtcNow.AddDays(-1);
        SetPriors(f, [StubProposal(f.Agent, f.DiscoveredHash, ProposalStatus.Accepted, decidedAt)]);
        SetCompletedSince(f, 0);

        var result = await f.Optimizer.DiscoverOptimizations(f.Group, CancellationToken);

        result.Should().BeEmpty();
    }

    [TestMethod]
    public async Task RejectedWithSameHash_ThresholdMet_ReSurfaces()
    {
        Fixture f = await BuildAsync();
        var decidedAt = DateTimeOffset.UtcNow.AddDays(-1);
        SetPriors(f, [StubProposal(f.Agent, f.DiscoveredHash, ProposalStatus.Rejected, decidedAt)]);
        SetCompletedSince(f, CompositeOptimizer.ResurfaceThreshold);

        var result = await f.Optimizer.DiscoverOptimizations(f.Group, CancellationToken);

        result.Should().HaveCount(1);
        await f.Proposals.Received(1).AddAsync(Arg.Any<IOptimizationProposal>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task DifferentHash_NotSuppressed()
    {
        Fixture f = await BuildAsync();
        SetPriors(f, [StubProposal(f.Agent, "deadbeef", ProposalStatus.Rejected, DateTimeOffset.UtcNow.AddDays(-1))]);

        var result = await f.Optimizer.DiscoverOptimizations(f.Group, CancellationToken);

        result.Should().HaveCount(1);
    }

    private static void SetPriors(Fixture f, IReadOnlyList<IOptimizationProposal> priors)
    {
        var byHash = priors
            .GroupBy(p => p.ContentHash)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.UpdatedAt).First());
        f.Proposals.FindLatestByContentHashAsync(f.Agent.Id, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(call => Task.FromResult(byHash.GetValueOrDefault(call.Arg<string>())));
    }

    private static void SetCompletedSince(Fixture f, int count)
        => f.GroupsRepo.CountCompletedSinceAsync(f.Agent.Id, Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(count));

    private static IOptimizationProposal StubProposal(IAgent agent, string hash, ProposalStatus status, DateTimeOffset updatedAt)
    {
        var p = Substitute.For<IOptimizationProposal>();
        p.Agent.Returns(agent);
        p.ContentHash.Returns(hash);
        p.Status.Returns(status);
        p.UpdatedAt.Returns(updatedAt);
        return p;
    }

    private async Task<Fixture> BuildAsync()
    {
        IServiceProvider services = GetServices();
        var agentGen = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var testRunGen = services.GetRequiredService<IDomainEntityGenerator<ITestRun>>();
        var sysPromptFactory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();

        var agent = await agentGen.GetOrCreateAsync();
        var abRun = await testRunGen.CreateAsync(CancellationToken);
        var discovered = sysPromptFactory(agent, Priority.Medium, "rationale", "the-prompt",
            null, null, [], abRun);

        var suite = Substitute.For<ITestSuite>();
        suite.Agent.Returns(agent);
        var group = Substitute.For<ITestRunGroup>();
        group.Id.Returns(Guid.NewGuid());
        group.Suite.Returns(suite);

        var existingRun = Substitute.For<ITestRun>();
        existingRun.Id.Returns(Guid.NewGuid());

        var testRunRepo = Substitute.For<ITestRunRepository>();
        testRunRepo.GetByGroupAsync(group.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<ITestRun>>([existingRun]));

        var proposalsRepo = Substitute.For<IOptimizationProposalRepository>();
        proposalsRepo.AddAsync(Arg.Any<IOptimizationProposal>(), Arg.Any<CancellationToken>())
            .Returns(call => Task.FromResult(call.Arg<IOptimizationProposal>()));

        var groupsRepo = Substitute.For<ITestRunGroupRepository>();
        groupsRepo.CountCompletedSinceAsync(agent.Id, Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(0));

        var optimizerImpl = Substitute.For<IOptimizerImplementation>();
        optimizerImpl.DiscoverOptimizations(group, Arg.Any<IReadOnlyList<ITestRun>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<IOptimizationProposal>>([discovered]));

        var composite = new CompositeOptimizer([optimizerImpl], testRunRepo, proposalsRepo, groupsRepo);

        return new Fixture
        {
            Agent = agent,
            Group = group,
            DiscoveredHash = discovered.ContentHash,
            Proposals = proposalsRepo,
            GroupsRepo = groupsRepo,
            Optimizer = composite,
        };
    }

    private sealed class Fixture
    {
        public required IAgent Agent { get; init; }
        public required ITestRunGroup Group { get; init; }
        public required string DiscoveredHash { get; init; }
        public required IOptimizationProposalRepository Proposals { get; init; }
        public required ITestRunGroupRepository GroupsRepo { get; init; }
        public required CompositeOptimizer Optimizer { get; init; }
    }
}
