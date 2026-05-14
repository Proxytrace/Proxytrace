using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class OptimizationProposalValidationTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateNew_SystemPrompt_CreatesProposal()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var proposal = factory(
            agent: agent,
            priority: Priority.High,
            rationale: "Tests failed due to vague instructions.",
            proposedSystemMessage: "Improved system prompt",
            evidenceTestRunIds: [Guid.NewGuid()]);

        proposal.Should().NotBeNull();
        proposal.Agent.Should().Be(agent);
        proposal.Kind.Should().Be(ProposalKind.SystemPrompt);
        proposal.Status.Should().Be(ProposalStatus.Draft);
        proposal.Priority.Should().Be(Priority.High);
        proposal.Rationale.Should().Be("Tests failed due to vague instructions.");
        proposal.ProposedSystemMessage.Should().Be("Improved system prompt");
        proposal.EvidenceTestRunIds.Should().ContainSingle();
        proposal.Id.Should().NotBe(Guid.Empty);
        proposal.CreatedAt.Should().NotBe(default);
        proposal.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_ToolUpdate_KindIsTool()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IToolUpdateProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var proposal = factory(
            agent: agent,
            priority: Priority.Medium,
            rationale: "Tool arguments were misused.",
            proposedTools: [],
            evidenceTestRunIds: []);

        proposal.Kind.Should().Be(ProposalKind.Tool);
        proposal.Status.Should().Be(ProposalStatus.Draft);
        proposal.ProposedTools.Should().BeEmpty();
    }

    [TestMethod]
    public async Task CreateNew_ModelSwitch_KindIsModelSwitch()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IModelSwitchProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);

        var proposal = factory(
            agent: agent,
            priority: Priority.Critical,
            rationale: "Switching model improves pass rate by 25%.",
            proposedEndpoint: endpoint,
            expectedPassRateDelta: 0.25,
            expectedCostDelta: -0.05m,
            expectedLatencyDelta: TimeSpan.FromMilliseconds(-200),
            evidenceTestRunIds: [Guid.NewGuid(), Guid.NewGuid()]);

        proposal.Kind.Should().Be(ProposalKind.ModelSwitch);
        proposal.ProposedEndpoint.Should().Be(endpoint);
        proposal.ExpectedPassRateDelta.Should().Be(0.25);
    }

    [TestMethod]
    public async Task CreateNew_WithEmptyRationale_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var action = () => factory(agent, Priority.Low, "   ", "msg", []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_NewProposal_AlwaysStartsAsDraft()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IToolUpdateProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var proposal = factory(agent, Priority.Low, "rationale", [], []);

        proposal.Status.Should().Be(ProposalStatus.Draft);
    }

    [TestMethod]
    public async Task CreateNew_IdIsUniqueForEachProposal()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IToolUpdateProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        var proposal1 = factory(agent, Priority.Low, "rationale", [], []);
        var proposal2 = factory(agent, Priority.Low, "rationale", [], []);

        proposal1.Id.Should().NotBe(proposal2.Id);
    }

    [TestMethod]
    public async Task CreateNew_WithMultipleEvidenceTestRunIds_TracksAllIds()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);
        var evidenceIds = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };

        var proposal = factory(
            agent: agent,
            priority: Priority.Medium,
            rationale: "Multiple test runs failed.",
            proposedSystemMessage: "New prompt",
            evidenceTestRunIds: evidenceIds);

        proposal.EvidenceTestRunIds.Should().HaveCount(3);
        proposal.EvidenceTestRunIds.Should().BeEquivalentTo(evidenceIds);
    }

    [TestMethod]
    public async Task CreateExisting_ReconstitutesSystemPromptProposalWithOriginalValues()
    {
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<ISystemPromptProposal.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ISystemPromptProposal>>();
        var existing = await generator.CreateAsync(CancellationToken);

        var reconstituted = createExisting(
            agent: existing.Agent,
            status: existing.Status,
            priority: existing.Priority,
            rationale: existing.Rationale,
            proposedSystemMessage: existing.ProposedSystemMessage,
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
        var createExisting = services.GetRequiredService<ISystemPromptProposal.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ISystemPromptProposal>>();
        var source = await generator.CreateAsync(CancellationToken);

        var accepted = createExisting(source.Agent, ProposalStatus.Accepted, source.Priority, source.Rationale, source.ProposedSystemMessage, source.EvidenceTestRunIds, source);
        var rejected = createExisting(source.Agent, ProposalStatus.Rejected, source.Priority, source.Rationale, source.ProposedSystemMessage, source.EvidenceTestRunIds, source);

        accepted.Status.Should().Be(ProposalStatus.Accepted);
        rejected.Status.Should().Be(ProposalStatus.Rejected);
    }

    private static async Task<IAgent> CreateAgentAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        return await generator.GetOrCreateAsync();
    }
}
