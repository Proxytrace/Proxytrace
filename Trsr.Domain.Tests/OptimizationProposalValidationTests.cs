using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class OptimizationProposalValidationTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithSystemPromptDetails_CreatesProposal()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);
        var details = new SystemPromptDetails("Improved system prompt");

        var proposal = factory(
            agent: agent,
            priority: Priority.High,
            rationale: "Tests failed due to vague instructions.",
            details: details,
            evidenceTestRunIds: [Guid.NewGuid()]);

        proposal.Should().NotBeNull();
        proposal.Agent.Should().Be(agent);
        proposal.Kind.Should().Be(ProposalKind.SystemPrompt);
        proposal.Status.Should().Be(ProposalStatus.Draft);
        proposal.Priority.Should().Be(Priority.High);
        proposal.Rationale.Should().Be("Tests failed due to vague instructions.");
        proposal.Details.Should().Be(details);
        proposal.EvidenceTestRunIds.Should().ContainSingle();
        proposal.Id.Should().NotBe(Guid.Empty);
        proposal.CreatedAt.Should().NotBe(default);
        proposal.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_WithToolDetails_KindIsToolAndDetailsCarriesTools()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var proposal = factory(
            agent: agent,
            priority: Priority.Medium,
            rationale: "Tool arguments were misused.",
            details: new ToolDetails([]),
            evidenceTestRunIds: []);

        proposal.Kind.Should().Be(ProposalKind.Tool);
        proposal.Status.Should().Be(ProposalStatus.Draft);
        proposal.Details.Should().BeOfType<ToolDetails>();
    }

    [TestMethod]
    public async Task CreateNew_WithModelSwitchDetails_KindIsModelSwitch()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);
        var endpointId = Guid.NewGuid();

        var proposal = factory(
            agent: agent,
            priority: Priority.Critical,
            rationale: "Switching model improves pass rate by 25%.",
            details: new ModelSwitchDetails(endpointId, 0.25, -0.05m, TimeSpan.FromMilliseconds(-200)),
            evidenceTestRunIds: [Guid.NewGuid(), Guid.NewGuid()]);

        proposal.Kind.Should().Be(ProposalKind.ModelSwitch);
        var switchDetails = proposal.Details.Should().BeOfType<ModelSwitchDetails>().Which;
        switchDetails.ProposedEndpointId.Should().Be(endpointId);
        switchDetails.ExpectedPassRateDelta.Should().Be(0.25);
    }

    [TestMethod]
    public async Task CreateNew_WithNullAgent_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();

        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(null!, Priority.Low, "rationale", new SystemPromptDetails("msg"), []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullRationale_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(agent, Priority.Low, null!, new SystemPromptDetails("msg"), []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithEmptyRationale_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var action = () => factory(agent, Priority.Low, "   ", new SystemPromptDetails("msg"), []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_NewProposal_AlwaysStartsAsDraft()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var proposal = factory(agent, Priority.Low, "rationale", new ToolDetails([]), []);

        proposal.Status.Should().Be(ProposalStatus.Draft);
    }

    [TestMethod]
    public async Task CreateNew_IdIsUniqueForEachProposal()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var proposal1 = factory(agent, Priority.Low, "rationale", new ToolDetails([]), []);
        var proposal2 = factory(agent, Priority.Low, "rationale", new ToolDetails([]), []);

        proposal1.Id.Should().NotBe(proposal2.Id);
    }

    [TestMethod]
    public async Task CreateNew_WithMultipleEvidenceTestRunIds_TracksAllIds()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);
        var evidenceIds = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };

        var proposal = factory(
            agent: agent,
            priority: Priority.Medium,
            rationale: "Multiple test runs failed.",
            details: new SystemPromptDetails("New prompt"),
            evidenceTestRunIds: evidenceIds);

        proposal.EvidenceTestRunIds.Should().HaveCount(3);
        proposal.EvidenceTestRunIds.Should().BeEquivalentTo(evidenceIds);
    }

    [TestMethod]
    public async Task CreateExisting_ReconstitutesProposalWithOriginalValues()
    {
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IOptimizationProposal.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOptimizationProposal>>();
        var existing = await generator.CreateAsync(CancellationToken);

        var reconstituted = createExisting(
            agent: existing.Agent,
            status: existing.Status,
            priority: existing.Priority,
            rationale: existing.Rationale,
            details: existing.Details,
            evidenceTestRunIds: existing.EvidenceTestRunIds,
            existing: existing);

        reconstituted.Id.Should().Be(existing.Id);
        reconstituted.Agent.Should().Be(existing.Agent);
        reconstituted.Kind.Should().Be(existing.Kind);
        reconstituted.Status.Should().Be(existing.Status);
        reconstituted.Priority.Should().Be(existing.Priority);
        reconstituted.Rationale.Should().Be(existing.Rationale);
        reconstituted.CreatedAt.Should().Be(existing.CreatedAt);
        reconstituted.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public async Task CreateExisting_CanReconstituteDraftAcceptedAndRejectedStatus()
    {
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IOptimizationProposal.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOptimizationProposal>>();
        var source = await generator.CreateAsync(CancellationToken);

        var accepted = createExisting(source.Agent, ProposalStatus.Accepted, source.Priority, source.Rationale, source.Details, source.EvidenceTestRunIds, source);
        var rejected = createExisting(source.Agent, ProposalStatus.Rejected, source.Priority, source.Rationale, source.Details, source.EvidenceTestRunIds, source);

        accepted.Status.Should().Be(ProposalStatus.Accepted);
        rejected.Status.Should().Be(ProposalStatus.Rejected);
    }

    private static async Task<IAgent> CreateAgentAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        return await generator.GetOrCreateAsync(default);
    }
}
