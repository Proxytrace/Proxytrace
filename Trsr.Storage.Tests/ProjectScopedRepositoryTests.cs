using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Inference;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestRunGroup;
using Trsr.Domain.TestSuite;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class ProjectScopedRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task TestSuiteRepository_GetByProjectAsync_FiltersByProject()
    {
        IServiceProvider services = GetServices();
        var suiteRepository = services.GetRequiredService<ITestSuiteRepository>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();
        var testCaseGenerator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();

        var (projectA, agentA) = await CreateProjectAndAgent(services);
        var (_, agentB) = await CreateProjectAndAgent(services);
        var caseA = await testCaseGenerator.CreateAsync(CancellationToken);
        var caseB = await testCaseGenerator.CreateAsync(CancellationToken);

        var suiteA = await suiteRepository.AddAsync(suiteFactory("Suite A", agentA, [], [caseA]), CancellationToken);
        var suiteB = await suiteRepository.AddAsync(suiteFactory("Suite B", agentB, [], [caseB]), CancellationToken);

        var resultsA = await suiteRepository.GetByProjectAsync(projectA.Id, CancellationToken);

        resultsA.Should().Contain(s => s.Id == suiteA.Id);
        resultsA.Should().NotContain(s => s.Id == suiteB.Id);
    }

    [TestMethod]
    public async Task TestRunGroupRepository_GetByProjectAsync_FiltersByProject()
    {
        IServiceProvider services = GetServices();
        var suiteRepository = services.GetRequiredService<ITestSuiteRepository>();
        var groupRepository = services.GetRequiredService<ITestRunGroupRepository>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();
        var groupFactory = services.GetRequiredService<ITestRunGroup.CreateNew>();
        var testCaseGenerator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();

        var (projectA, agentA) = await CreateProjectAndAgent(services);
        var (_, agentB) = await CreateProjectAndAgent(services);
        var caseA = await testCaseGenerator.CreateAsync(CancellationToken);
        var caseB = await testCaseGenerator.CreateAsync(CancellationToken);

        var suiteA = await suiteRepository.AddAsync(suiteFactory("Suite A", agentA, [], [caseA]), CancellationToken);
        var suiteB = await suiteRepository.AddAsync(suiteFactory("Suite B", agentB, [], [caseB]), CancellationToken);
        var groupA = await groupRepository.AddAsync(groupFactory(suiteA), CancellationToken);
        var groupB = await groupRepository.AddAsync(groupFactory(suiteB), CancellationToken);

        var resultsA = await groupRepository.GetByProjectAsync(projectA.Id, CancellationToken);

        resultsA.Should().Contain(g => g.Id == groupA.Id);
        resultsA.Should().NotContain(g => g.Id == groupB.Id);
    }

    [TestMethod]
    public async Task OptimizationProposalRepository_GetByProjectAsync_FiltersByProject()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IOptimizationProposalRepository>();
        var factory = services.GetRequiredService<IOptimizationProposal.CreateNew>();

        var (projectA, agentA) = await CreateProjectAndAgent(services);
        var (_, agentB) = await CreateProjectAndAgent(services);
        var details = new SystemPromptDetails("Improved system prompt");

        var inA = await repository.AddAsync(
            factory(agentA, Priority.Medium, "rationale A", details, [Guid.NewGuid()]),
            CancellationToken);
        var inB = await repository.AddAsync(
            factory(agentB, Priority.Medium, "rationale B", details, [Guid.NewGuid()]),
            CancellationToken);

        var resultsA = await repository.GetByProjectAsync(projectA.Id, CancellationToken);

        resultsA.Should().Contain(p => p.Id == inA.Id);
        resultsA.Should().NotContain(p => p.Id == inB.Id);
    }

    private async Task<(IProject project, IAgent agent)> CreateProjectAndAgent(IServiceProvider services)
    {
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var agentRepository = services.GetRequiredService<IRepository<IAgent>>();
        var agentFactory = services.GetRequiredService<IAgent.CreateNew>();
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var modelParametersFactory = services.GetRequiredService<IModelParameters.Create>();

        var project = await projectGenerator.CreateAsync(CancellationToken);
        var endpoint = await endpointGenerator.GetOrCreateAsync(CancellationToken);
        var prompt = promptFactory($"Agent-{Guid.NewGuid():N}", "You are a helpful assistant.");

        var agent = agentFactory(
            $"agent-{Guid.NewGuid():N}",
            prompt,
            [],
            endpoint,
            project,
            modelParametersFactory());
        var added = await agentRepository.AddAsync(agent, CancellationToken);
        return (project, added);
    }
}
