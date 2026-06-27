using Proxytrace.Domain.AuditLog;
using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Common.Async;
using Proxytrace.Application.Optimization;
using Proxytrace.Application.Optimization.Internal;
using Proxytrace.Application.Optimization.Internal.Validation;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class TheoryValidationServiceTests : BaseTest<Module>
{
    private const string Hash = "abc123";

    [TestMethod]
    public async Task FirstSubmission_NoPriors_Accepted()
    {
        Fixture f = Build();

        var result = await f.Service.SubmitAsync(f.Theory, CancellationToken);

        result.Outcome.Should().Be(TheorySubmissionOutcome.Accepted);
        await f.Theories.Received(1).AddAsync(f.Theory, Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task PriorTheorySameHash_NotInvalidated_Duplicate()
    {
        Fixture f = Build();
        var prior = StubTheory(TheoryStatus.Validating);
        f.Theories.FindLatestByContentHashAsync(f.AgentId, Hash, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IOptimizationTheory?>(prior));

        var result = await f.Service.SubmitAsync(f.Theory, CancellationToken);

        result.Outcome.Should().Be(TheorySubmissionOutcome.Duplicate);
        await f.Theories.DidNotReceive().AddAsync(Arg.Any<IOptimizationTheory>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task PriorTheoryInvalidated_AllowsResubmission()
    {
        Fixture f = Build();
        var prior = StubTheory(TheoryStatus.Invalidated);
        f.Theories.FindLatestByContentHashAsync(f.AgentId, Hash, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IOptimizationTheory?>(prior));

        var result = await f.Service.SubmitAsync(f.Theory, CancellationToken);

        result.Outcome.Should().Be(TheorySubmissionOutcome.Accepted);
    }

    [TestMethod]
    public async Task DraftProposalSameHash_Duplicate()
    {
        Fixture f = Build();
        SetPriorProposal(f, ProposalStatus.Draft, DateTimeOffset.UtcNow);

        var result = await f.Service.SubmitAsync(f.Theory, CancellationToken);

        result.Outcome.Should().Be(TheorySubmissionOutcome.Duplicate);
    }

    [TestMethod]
    public async Task RejectedProposalSameHash_FewCompletedGroups_Duplicate()
    {
        Fixture f = Build();
        SetPriorProposal(f, ProposalStatus.Rejected, DateTimeOffset.UtcNow.AddDays(-1));
        SetCompletedSince(f, 2);

        var result = await f.Service.SubmitAsync(f.Theory, CancellationToken);

        result.Outcome.Should().Be(TheorySubmissionOutcome.Duplicate);
    }

    [TestMethod]
    public async Task RejectedProposalSameHash_ThresholdMet_Accepted()
    {
        Fixture f = Build();
        SetPriorProposal(f, ProposalStatus.Rejected, DateTimeOffset.UtcNow.AddDays(-1));
        SetCompletedSince(f, TheoryValidationService.ResurfaceThreshold);

        var result = await f.Service.SubmitAsync(f.Theory, CancellationToken);

        result.Outcome.Should().Be(TheorySubmissionOutcome.Accepted);
    }

    [TestMethod]
    public async Task DifferentHash_Accepted()
    {
        Fixture f = Build();
        // prior proposal exists only under a different hash, so lookup for our hash returns null
        f.Proposals.FindLatestByContentHashAsync(f.AgentId, Hash, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IOptimizationProposal?>(null));

        var result = await f.Service.SubmitAsync(f.Theory, CancellationToken);

        result.Outcome.Should().Be(TheorySubmissionOutcome.Accepted);
    }

    [TestMethod]
    public async Task QuotaExceeded_WhenBacklogFull()
    {
        Fixture f = Build();
        f.Theories.CountActiveByProjectAsync(f.ProjectId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(TheoryValidationService.MaxInFlightPerProject));

        var result = await f.Service.SubmitAsync(f.Theory, CancellationToken);

        result.Outcome.Should().Be(TheorySubmissionOutcome.QuotaExceeded);
        await f.Theories.DidNotReceive().AddAsync(Arg.Any<IOptimizationTheory>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reset_Invalidated_NoProposal_ResetsTheory()
    {
        Fixture f = Build();
        var theory = StubResettableTheory(TheoryStatus.Invalidated, resultingProposalId: null);
        f.Theories.FindAsync(theory.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(theory));

        var result = await f.Service.ResetToProposedAsync(theory.Id, CancellationToken);

        result.Outcome.Should().Be(TheoryResetOutcome.Reset);
        await theory.Received(1).ResetToProposed(Arg.Any<CancellationToken>());
        await f.Proposals.DidNotReceive().RemoveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reset_Validated_DraftProposal_DeletesProposalAndResets()
    {
        Fixture f = Build();
        var proposalId = Guid.NewGuid();
        var theory = StubResettableTheory(TheoryStatus.Validated, proposalId);
        f.Theories.FindAsync(theory.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(theory));
        var proposal = Substitute.For<IOptimizationProposal>();
        proposal.Status.Returns(ProposalStatus.Draft);
        f.Proposals.FindAsync(proposalId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationProposal?>(proposal));

        var result = await f.Service.ResetToProposedAsync(theory.Id, CancellationToken);

        result.Outcome.Should().Be(TheoryResetOutcome.Reset);
        await theory.Received(1).ResetToProposed(Arg.Any<CancellationToken>());
        await f.Proposals.Received(1).RemoveAsync(proposalId, Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reset_Validated_AcceptedProposal_Blocked()
    {
        Fixture f = Build();
        var proposalId = Guid.NewGuid();
        var theory = StubResettableTheory(TheoryStatus.Validated, proposalId);
        f.Theories.FindAsync(theory.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(theory));
        var proposal = Substitute.For<IOptimizationProposal>();
        proposal.Status.Returns(ProposalStatus.Accepted);
        f.Proposals.FindAsync(proposalId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationProposal?>(proposal));

        var result = await f.Service.ResetToProposedAsync(theory.Id, CancellationToken);

        result.Outcome.Should().Be(TheoryResetOutcome.BlockedByAcceptedProposal);
        await theory.DidNotReceive().ResetToProposed(Arg.Any<CancellationToken>());
        await f.Proposals.DidNotReceive().RemoveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reset_Validated_AdoptedProposal_Blocked()
    {
        Fixture f = Build();
        var proposalId = Guid.NewGuid();
        var theory = StubResettableTheory(TheoryStatus.Validated, proposalId);
        f.Theories.FindAsync(theory.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(theory));
        var proposal = Substitute.For<IOptimizationProposal>();
        proposal.Status.Returns(ProposalStatus.Adopted);
        f.Proposals.FindAsync(proposalId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationProposal?>(proposal));

        var result = await f.Service.ResetToProposedAsync(theory.Id, CancellationToken);

        result.Outcome.Should().Be(TheoryResetOutcome.BlockedByAcceptedProposal);
        await theory.DidNotReceive().ResetToProposed(Arg.Any<CancellationToken>());
        await f.Proposals.DidNotReceive().RemoveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reset_ProposedTheory_NotResettable()
    {
        Fixture f = Build();
        var theory = StubResettableTheory(TheoryStatus.Proposed, resultingProposalId: null);
        f.Theories.FindAsync(theory.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(theory));

        var result = await f.Service.ResetToProposedAsync(theory.Id, CancellationToken);

        result.Outcome.Should().Be(TheoryResetOutcome.NotResettable);
        await theory.DidNotReceive().ResetToProposed(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reset_UnknownTheory_NotFound()
    {
        Fixture f = Build();
        var unknownId = Guid.NewGuid();
        f.Theories.FindAsync(unknownId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(null));

        var result = await f.Service.ResetToProposedAsync(unknownId, CancellationToken);

        result.Outcome.Should().Be(TheoryResetOutcome.NotFound);
    }

    [TestMethod]
    public async Task Reject_ProposedTheory_TransitionsToInvalidated()
    {
        Fixture f = Build();
        var theory = StubRejectableTheory(TheoryStatus.Proposed);
        f.Theories.FindAsync(theory.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(theory));

        var result = await f.Service.RejectAsync(theory.Id, CancellationToken);

        result.Outcome.Should().Be(TheoryRejectOutcome.Rejected);
        await theory.Received(1).Reject(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reject_ValidatingTheory_TransitionsToInvalidated()
    {
        Fixture f = Build();
        var theory = StubRejectableTheory(TheoryStatus.Validating);
        f.Theories.FindAsync(theory.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(theory));

        var result = await f.Service.RejectAsync(theory.Id, CancellationToken);

        result.Outcome.Should().Be(TheoryRejectOutcome.Rejected);
        await theory.Received(1).Reject(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reject_TerminalTheory_NotActive()
    {
        Fixture f = Build();
        var theory = StubRejectableTheory(TheoryStatus.Validated);
        f.Theories.FindAsync(theory.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(theory));

        var result = await f.Service.RejectAsync(theory.Id, CancellationToken);

        result.Outcome.Should().Be(TheoryRejectOutcome.NotActive);
        await theory.DidNotReceive().Reject(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reject_UnknownTheory_NotFound()
    {
        Fixture f = Build();
        var unknownId = Guid.NewGuid();
        f.Theories.FindAsync(unknownId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IOptimizationTheory?>(null));

        var result = await f.Service.RejectAsync(unknownId, CancellationToken);

        result.Outcome.Should().Be(TheoryRejectOutcome.NotFound);
    }

    private void SetPriorProposal(Fixture f, ProposalStatus status, DateTimeOffset updatedAt)
    {
        var proposal = Substitute.For<IOptimizationProposal>();
        proposal.ContentHash.Returns(Hash);
        proposal.Status.Returns(status);
        proposal.UpdatedAt.Returns(updatedAt);
        f.Proposals.FindLatestByContentHashAsync(f.AgentId, Hash, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IOptimizationProposal?>(proposal));
    }

    private static void SetCompletedSince(Fixture f, int count)
        => f.Groups.CountCompletedSinceAsync(f.AgentId, Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(count));

    private IOptimizationTheory StubTheory(TheoryStatus status)
    {
        var theory = Substitute.For<IOptimizationTheory>();
        theory.ContentHash.Returns(Hash);
        theory.Status.Returns(status);
        return theory;
    }

    private static Fixture Build()
    {
        var projectId = Guid.NewGuid();
        var agentId = Guid.NewGuid();

        var project = Substitute.For<IProject>();
        project.Id.Returns(projectId);
        var agent = Substitute.For<IAgent>();
        agent.Id.Returns(agentId);
        agent.Project.Returns(project);

        var theory = Substitute.For<IOptimizationTheory>();
        theory.Id.Returns(Guid.NewGuid());
        theory.Agent.Returns(agent);
        theory.ContentHash.Returns(Hash);
        theory.Status.Returns(TheoryStatus.Proposed);

        var theories = Substitute.For<IOptimizationTheoryRepository>();
        theories.AddAsync(Arg.Any<IOptimizationTheory>(), Arg.Any<CancellationToken>())
            .Returns(call => Task.FromResult(call.Arg<IOptimizationTheory>()));
        // No prior theory by default (NSubstitute would otherwise auto-substitute a non-null match).
        theories.FindLatestByContentHashAsync(agentId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IOptimizationTheory?>(null));

        var proposals = Substitute.For<IOptimizationProposalRepository>();
        proposals.FindLatestByContentHashAsync(agentId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IOptimizationProposal?>(null));
        var groups = Substitute.For<ITestRunGroupRepository>();
        groups.CountCompletedSinceAsync(agentId, Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(0));

        // Run the transactional body inline so reset writes actually execute.
        var transaction = Substitute.For<Domain.ITransaction>();
        transaction.InvokeAsync(Arg.Any<Func<Task<IOptimizationTheory>>>())
            .Returns(ci => ci.Arg<Func<Task<IOptimizationTheory>>>().Invoke());

        var service = new TheoryValidationService(
            theories,
            proposals,
            groups,
            [],
            Substitute.For<IProposalBroadcaster>(),
            Substitute.For<ITheoryBroadcaster>(),
            transaction,
            new NoOpAsyncLock(),
            NullLogger<TheoryValidationService>.Instance,
            NullLogger<Audit>.Instance);

        return new Fixture
        {
            Service = service,
            Theory = theory,
            AgentId = agentId,
            ProjectId = projectId,
            Theories = theories,
            Proposals = proposals,
            Groups = groups,
        };
    }

    private static IOptimizationTheory StubResettableTheory(TheoryStatus status, Guid? resultingProposalId)
    {
        var theory = Substitute.For<IOptimizationTheory>();
        theory.Id.Returns(Guid.NewGuid());
        theory.Status.Returns(status);
        theory.ResultingProposalId.Returns(resultingProposalId);
        var reset = Substitute.For<IOptimizationTheory>();
        reset.Status.Returns(TheoryStatus.Proposed);
        theory.ResetToProposed(Arg.Any<CancellationToken>()).Returns(Task.FromResult(reset));
        return theory;
    }

    private static IOptimizationTheory StubRejectableTheory(TheoryStatus status)
    {
        var theory = Substitute.For<IOptimizationTheory>();
        theory.Id.Returns(Guid.NewGuid());
        theory.Status.Returns(status);
        var rejected = Substitute.For<IOptimizationTheory>();
        rejected.Status.Returns(TheoryStatus.Invalidated);
        theory.Reject(Arg.Any<CancellationToken>()).Returns(Task.FromResult(rejected));
        return theory;
    }

    private sealed class NoOpAsyncLock : IAsyncLock
    {
        public IDisposable Lock(object key) => new Handle();
        public Task<IDisposable> LockAsync(object key, CancellationToken cancellationToken = default) =>
            Task.FromResult<IDisposable>(new Handle());

        private sealed class Handle : IDisposable
        {
            public void Dispose() { }
        }
    }

    private sealed class Fixture
    {
        public required TheoryValidationService Service { get; init; }
        public required IOptimizationTheory Theory { get; init; }
        public required Guid AgentId { get; init; }
        public required Guid ProjectId { get; init; }
        public required IOptimizationTheoryRepository Theories { get; init; }
        public required IOptimizationProposalRepository Proposals { get; init; }
        public required ITestRunGroupRepository Groups { get; init; }
    }
}
