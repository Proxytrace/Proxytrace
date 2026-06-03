using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Testing;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class OptimizationTheoryValidationTests : DomainTest<Module>
{
    [TestMethod]
    public async Task CreateNew_ProducesProposedTheory()
    {
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ISystemPromptTheory>>();

        ISystemPromptTheory theory = await generator.GenerateAsync(CancellationToken);

        theory.Id.Should().NotBe(Guid.Empty);
        theory.Status.Should().Be(TheoryStatus.Proposed);
        theory.Source.Should().Be(TheorySource.Optimizer);
        theory.Kind.Should().Be(ProposalKind.SystemPrompt);
        theory.ResultingProposalId.Should().BeNull();
        theory.ContentHash.Should().NotBeNullOrWhiteSpace();
        theory.ProposedSystemMessage.Should().NotBeNullOrWhiteSpace();
    }

    [TestMethod]
    public async Task SetValidating_FromProposed_TransitionsToValidating()
    {
        IServiceProvider services = GetServices();
        var theory = await CreateTheory(services);

        var updated = await theory.SetValidating(CancellationToken);

        updated.Status.Should().Be(TheoryStatus.Validating);

        var repo = services.GetRequiredService<IRepository<IOptimizationTheory>>();
        var reloaded = await repo.GetAsync(theory.Id, CancellationToken);
        reloaded.Status.Should().Be(TheoryStatus.Validating);
    }

    [TestMethod]
    public async Task SetValidated_FromValidating_RecordsResultingProposal()
    {
        IServiceProvider services = GetServices();
        var theory = await CreateTheory(services);
        var validating = await theory.SetValidating(CancellationToken);
        var proposalId = Guid.NewGuid();

        var validated = await validating.SetValidated(proposalId, CancellationToken);

        validated.Status.Should().Be(TheoryStatus.Validated);
        validated.ResultingProposalId.Should().Be(proposalId);
    }

    [TestMethod]
    public async Task SetInvalidated_FromValidating_TransitionsToInvalidated()
    {
        IServiceProvider services = GetServices();
        var theory = await CreateTheory(services);
        var validating = await theory.SetValidating(CancellationToken);

        var invalidated = await validating.SetInvalidated(CancellationToken);

        invalidated.Status.Should().Be(TheoryStatus.Invalidated);
    }

    [TestMethod]
    public async Task SetValidated_FromProposed_Throws()
    {
        IServiceProvider services = GetServices();
        var theory = await CreateTheory(services);

        await FluentActions
            .Invoking(() => theory.SetValidated(Guid.NewGuid(), CancellationToken))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [TestMethod]
    public async Task SetValidating_WhenNotProposed_Throws()
    {
        IServiceProvider services = GetServices();
        var theory = await CreateTheory(services);
        var validating = await theory.SetValidating(CancellationToken);

        await FluentActions
            .Invoking(() => validating.SetValidating(CancellationToken))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [TestMethod]
    public async Task ContentHash_MatchesEquivalentProposal()
    {
        IServiceProvider services = GetServices();
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var suite = await services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>().CreateAsync(CancellationToken);
        var abRun = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);

        const string message = "You are a precise and structured assistant.";

        var theoryFactory = services.GetRequiredService<ISystemPromptTheory.CreateNew>();
        var proposalFactory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();

        var theory = theoryFactory(agent, suite, TheorySource.User, Priority.Medium, "rationale", message, []);
        var proposal = proposalFactory(agent, Priority.Medium, "rationale", message, null, null, [], abRun);

        theory.ContentHash.Should().Be(proposal.ContentHash);
    }

    private async Task<ISystemPromptTheory> CreateTheory(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<ISystemPromptTheory>>();
        return await generator.CreateAsync(CancellationToken);
    }
}
