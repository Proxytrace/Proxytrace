using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestRun;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class OptimizationProposalValidationTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidSystemPromptProposal_CreatesProposal()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);
        var proposedMessage = new SystemMessage("Improved system prompt");

        // Act
        var proposal = factory(
            agent: agent,
            kind: ProposalKind.SystemPrompt,
            rationale: "Tests failed due to vague instructions.",
            proposedSystemMessage: proposedMessage,
            proposedTools: [],
            evidenceTestRunIds: [Guid.NewGuid()]);

        // Assert
        proposal.Should().NotBeNull();
        proposal.Agent.Should().Be(agent);
        proposal.Kind.Should().Be(ProposalKind.SystemPrompt);
        proposal.Status.Should().Be(ProposalStatus.Draft);
        proposal.Rationale.Should().Be("Tests failed due to vague instructions.");
        proposal.ProposedSystemMessage.Should().Be(proposedMessage);
        proposal.ProposedTools.Should().BeEmpty();
        proposal.EvidenceTestRunIds.Should().ContainSingle();
        proposal.Id.Should().NotBe(Guid.Empty);
        proposal.CreatedAt.Should().NotBe(default);
        proposal.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_WithToolKind_CreatesProposalWithoutSystemMessage()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        // Act
        var proposal = factory(
            agent: agent,
            kind: ProposalKind.Tool,
            rationale: "Tool arguments were misused.",
            proposedSystemMessage: null,
            proposedTools: [],
            evidenceTestRunIds: []);

        // Assert
        proposal.Kind.Should().Be(ProposalKind.Tool);
        proposal.ProposedSystemMessage.Should().BeNull();
        proposal.Status.Should().Be(ProposalStatus.Draft);
    }

    [TestMethod]
    public async Task CreateNew_WithBothKind_CreatesProposalWithSystemMessage()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);
        var proposedMessage = new SystemMessage("Refactored system prompt");

        // Act
        var proposal = factory(
            agent: agent,
            kind: ProposalKind.Both,
            rationale: "Both prompt and tools need improvement.",
            proposedSystemMessage: proposedMessage,
            proposedTools: [],
            evidenceTestRunIds: []);

        // Assert
        proposal.Kind.Should().Be(ProposalKind.Both);
        proposal.ProposedSystemMessage.Should().Be(proposedMessage);
    }

    [TestMethod]
    public async Task CreateNew_WithNullAgent_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(null!, ProposalKind.SystemPrompt, "rationale", new SystemMessage("msg"), [], []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullRationale_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(agent, ProposalKind.SystemPrompt, null!, new SystemMessage("msg"), [], []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithEmptyRationale_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        // Act & Assert
        var action = () => factory(agent, ProposalKind.SystemPrompt, "   ", new SystemMessage("msg"), [], []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_SystemPromptKindWithNullSystemMessage_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        // Act & Assert
        var action = () => factory(agent, ProposalKind.SystemPrompt, "rationale", null, [], []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_BothKindWithNullSystemMessage_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        // Act & Assert
        var action = () => factory(agent, ProposalKind.Both, "rationale", null, [], []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_NewProposal_AlwaysStartsAsDraft()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        // Act
        var proposal = factory(agent, ProposalKind.Tool, "rationale", null, [], []);

        // Assert - proposals always start as Draft; no automatic rollout
        proposal.Status.Should().Be(ProposalStatus.Draft);
    }

    [TestMethod]
    public async Task CreateNew_WithMultipleEvidenceTestRunIds_TracksAllIds()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);
        var evidenceIds = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };

        // Act
        var proposal = factory(
            agent: agent,
            kind: ProposalKind.SystemPrompt,
            rationale: "Multiple test runs failed.",
            proposedSystemMessage: new SystemMessage("New prompt"),
            proposedTools: [],
            evidenceTestRunIds: evidenceIds);

        // Assert
        proposal.EvidenceTestRunIds.Should().HaveCount(3);
        proposal.EvidenceTestRunIds.Should().BeEquivalentTo(evidenceIds);
    }

    [TestMethod]
    public async Task CreateNew_IdIsUniqueForEachProposal()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();
        var agent = await CreateAgentAsync(services);

        // Act
        var proposal1 = factory(agent, ProposalKind.Tool, "rationale", null, [], []);
        var proposal2 = factory(agent, ProposalKind.Tool, "rationale", null, [], []);

        // Assert
        proposal1.Id.Should().NotBe(proposal2.Id);
    }

    [TestMethod]
    public async Task CreateExisting_ReconstitutesProposalWithOriginalValues()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IOptimizationProposal.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOptimizationProposal>>();
        var existing = await generator.CreateAsync(CancellationToken);

        // Act
        var reconstituted = createExisting(
            agent: existing.Agent,
            kind: existing.Kind,
            status: existing.Status,
            rationale: existing.Rationale,
            proposedSystemMessage: existing.ProposedSystemMessage,
            proposedTools: existing.ProposedTools,
            evidenceTestRunIds: existing.EvidenceTestRunIds,
            existing: existing);

        // Assert
        reconstituted.Id.Should().Be(existing.Id);
        reconstituted.Agent.Should().Be(existing.Agent);
        reconstituted.Kind.Should().Be(existing.Kind);
        reconstituted.Status.Should().Be(existing.Status);
        reconstituted.Rationale.Should().Be(existing.Rationale);
        reconstituted.CreatedAt.Should().Be(existing.CreatedAt);
        reconstituted.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public async Task CreateExisting_CanReconstituteDraftAcceptedAndRejectedStatus()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IOptimizationProposal.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOptimizationProposal>>();
        var source = await generator.CreateAsync(CancellationToken);

        // Act
        var accepted = createExisting(source.Agent, source.Kind, ProposalStatus.Accepted, source.Rationale,
            source.ProposedSystemMessage, source.ProposedTools, source.EvidenceTestRunIds, source);
        var rejected = createExisting(source.Agent, source.Kind, ProposalStatus.Rejected, source.Rationale,
            source.ProposedSystemMessage, source.ProposedTools, source.EvidenceTestRunIds, source);

        // Assert
        accepted.Status.Should().Be(ProposalStatus.Accepted);
        rejected.Status.Should().Be(ProposalStatus.Rejected);
    }

    private static async Task<IAgent> CreateAgentAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        return await generator.GetOrCreateAsync(default);
    }
}
