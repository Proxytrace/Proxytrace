using System.Text.RegularExpressions;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestSuite;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

/// <summary>
/// Exhaustive round-trip test for every <see cref="EvaluatorKind"/>.
/// Adding a new kind without implementing storage will cause <see cref="AllKinds_CanBePersisted"/> to fail.
/// </summary>
[TestClass]
public sealed class EvaluatorPersistenceTests : BaseTest<Module>
{
    public static IEnumerable<object[]> AllEvaluatorKinds
        => Enum.GetValues<EvaluatorKind>().Select(k => new object[] { k });

    [TestMethod]
    [DynamicData(nameof(AllEvaluatorKinds))]
    public async Task AllKinds_CanBePersisted(EvaluatorKind kind)
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IEvaluator>>();

        var evaluator = await CreateForKind(kind, services);
        var added = await repository.AddAsync(evaluator, CancellationToken);
        var retrieved = await repository.GetAsync(added.Id, CancellationToken);

        retrieved.Id.Should().Be(added.Id);
        retrieved.Kind.Should().Be(kind);
    }

    private async Task<IEvaluator> CreateForKind(EvaluatorKind kind, IServiceProvider services)
    {
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var project = await projectGenerator.CreateAsync(CancellationToken);
        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();

        return kind switch
        {
            EvaluatorKind.ExactMatch =>
                services.GetRequiredService<IExactMatchEvaluator.CreateNew>()(project),
            EvaluatorKind.NumericMatch =>
                services.GetRequiredService<INumericMatchEvaluator.CreateNew>()(new Regex(@"\d+(?:\.\d+)?"), 0.01m, project),
            EvaluatorKind.JsonSchemaMatch =>
                services.GetRequiredService<IJsonSchemaMatchEvaluator.CreateNew>()("""{"type": "object"}""", project),
            EvaluatorKind.Custom =>
                services.GetRequiredService<ICustomEvaluator.CreateNew>()(
                    promptFactory("Test Evaluator", "Evaluate."),
                    project),
            EvaluatorKind.Helpfulness =>
                services.GetRequiredService<IHelpfulnessEvaluator.CreateNew>()(project),
            EvaluatorKind.Politeness =>
                services.GetRequiredService<IPolitenessEvaluator.CreateNew>()(project),
            EvaluatorKind.Safety =>
                services.GetRequiredService<ISafetyClassifier.CreateNew>()(project),
            EvaluatorKind.ToolUsage =>
                services.GetRequiredService<IToolUsageEvaluator.CreateNew>()(project),
            _ => throw new NotSupportedException(
                $"{kind} has no test data — add a case to {nameof(CreateForKind)}.")
        };
    }
}

[TestClass]
public sealed class EvaluatorRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task AddAsync_ExactMatchEvaluator_Persists()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IEvaluator>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>();

        var evaluator = await generator.CreateAsync(CancellationToken);

        var retrieved = await repository.GetAsync(evaluator.Id, CancellationToken);

        retrieved.Id.Should().Be(evaluator.Id);
        retrieved.Kind.Should().Be(EvaluatorKind.ExactMatch);
        retrieved.Should().BeAssignableTo<IExactMatchEvaluator>();
    }

    [TestMethod]
    public async Task AddAsync_AgenticEvaluator_PersistsWithSystemMessage()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IEvaluator>>();
        var factory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();

        var project = await projectGenerator.CreateAsync(CancellationToken);
        var systemPrompt = promptFactory("Test Evaluator", "Judge whether the response is correct.");
        var evaluator = factory(systemPrompt, project);
        var added = await repository.AddAsync(evaluator, CancellationToken);

        var retrieved = await repository.GetAsync(added.Id, CancellationToken);

        retrieved.Id.Should().Be(added.Id);
        retrieved.Kind.Should().Be(EvaluatorKind.Custom);
        var custom = retrieved.Should().BeAssignableTo<ICustomEvaluator>().Subject;
        custom.SystemPrompt.Template.Should().Be("Judge whether the response is correct.");
    }

    [TestMethod]
    public async Task GetAllAsync_ReturnsAllEvaluators()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IEvaluator>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();

        var project = await projectGenerator.CreateAsync(CancellationToken);
        var exact = exactFactory(project);
        var agentic = agenticFactory(promptFactory("Test Evaluator", "Evaluate."), project);
        await repository.AddAsync(exact, CancellationToken);
        await repository.AddAsync(agentic, CancellationToken);

        var all = await repository.GetAllAsync(CancellationToken);

        all.Should().HaveCountGreaterThanOrEqualTo(2);
        all.Should().Contain(e => e.Id == exact.Id && e.Kind == EvaluatorKind.ExactMatch);
        all.Should().Contain(e => e.Id == agentic.Id && e.Kind == EvaluatorKind.Custom);
    }
}

[TestClass]
public sealed class TestSuiteEvaluatorRelationshipTests : BaseTest<Module>
{
    [TestMethod]
    public async Task AddAsync_WithMultipleEvaluators_PersistsAll()
    {
        IServiceProvider services = GetServices();
        var suiteRepository = services.GetRequiredService<IRepository<ITestSuite>>();
        var evaluatorRepository = services.GetRequiredService<IRepository<IEvaluator>>();
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var testCaseGenerator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var project = await projectGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(project), CancellationToken);
        var agentic = await evaluatorRepository.AddAsync(
            agenticFactory(promptFactory("Test Evaluator", "Score it."), project), CancellationToken);

        var suite = suiteFactory("Multi-eval suite", agent, [exact, agentic], [testCase]);
        var added = await suiteRepository.AddAsync(suite, CancellationToken);

        added.Evaluators.Should().HaveCount(2);
        added.Evaluators.Should().Contain(e => e.Id == exact.Id);
        added.Evaluators.Should().Contain(e => e.Id == agentic.Id);
    }

    [TestMethod]
    public async Task GetAsync_WithMultipleEvaluators_LoadsAll()
    {
        IServiceProvider services = GetServices();
        var suiteRepository = services.GetRequiredService<IRepository<ITestSuite>>();
        var evaluatorRepository = services.GetRequiredService<IRepository<IEvaluator>>();
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var testCaseGenerator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var project = await projectGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(project), CancellationToken);
        var agentic = await evaluatorRepository.AddAsync(
            agenticFactory(promptFactory("Test Evaluator", "Score it."), project), CancellationToken);

        var suite = suiteFactory("Get suite", agent, [exact, agentic], [testCase]);
        await suiteRepository.AddAsync(suite, CancellationToken);

        var retrieved = await suiteRepository.GetAsync(suite.Id, CancellationToken);

        retrieved.Id.Should().Be(suite.Id);
        retrieved.Evaluators.Should().HaveCount(2);
        retrieved.Evaluators.Should().Contain(e => e.Id == exact.Id && e.Kind == EvaluatorKind.ExactMatch);
        var agenticRetrieved = retrieved.Evaluators.First(e => e.Id == agentic.Id);
        agenticRetrieved.Kind.Should().Be(EvaluatorKind.Custom);
        agenticRetrieved.Should().BeAssignableTo<ICustomEvaluator>();
    }

    [TestMethod]
    public async Task UpdateAsync_AddingEvaluator_UpdatesRelationship()
    {
        IServiceProvider services = GetServices();
        var suiteRepository = services.GetRequiredService<IRepository<ITestSuite>>();
        var evaluatorRepository = services.GetRequiredService<IRepository<IEvaluator>>();
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var testCaseGenerator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();
        var suiteExistingFactory = services.GetRequiredService<ITestSuite.CreateExisting>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var project = await projectGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(project), CancellationToken);
        var agentic = await evaluatorRepository.AddAsync(
            agenticFactory(promptFactory("Test Evaluator", "Score it."), project), CancellationToken);

        var suite = suiteFactory("Update suite", agent, [exact], [testCase]);
        var added = await suiteRepository.AddAsync(suite, CancellationToken);

        var updated = suiteExistingFactory(added.Name, added.Agent, [exact, agentic], added.TestCases, added);
        var result = await suiteRepository.UpdateAsync(updated, CancellationToken);

        result.Evaluators.Should().HaveCount(2);
        result.Evaluators.Should().Contain(e => e.Id == exact.Id);
        result.Evaluators.Should().Contain(e => e.Id == agentic.Id);

        var retrieved = await suiteRepository.GetAsync(result.Id, CancellationToken);
        retrieved.Evaluators.Should().HaveCount(2);
    }

    [TestMethod]
    public async Task UpdateAsync_RemovingEvaluator_UpdatesRelationship()
    {
        IServiceProvider services = GetServices();
        var suiteRepository = services.GetRequiredService<IRepository<ITestSuite>>();
        var evaluatorRepository = services.GetRequiredService<IRepository<IEvaluator>>();
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var testCaseGenerator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();
        var suiteExistingFactory = services.GetRequiredService<ITestSuite.CreateExisting>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var project = await projectGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(project), CancellationToken);
        var agentic = await evaluatorRepository.AddAsync(
            agenticFactory(promptFactory("Test Evaluator", "Score it."), project), CancellationToken);

        var suite = suiteFactory("Remove eval suite", agent, [exact, agentic], [testCase]);
        var added = await suiteRepository.AddAsync(suite, CancellationToken);

        var updated = suiteExistingFactory(added.Name, added.Agent, [exact], added.TestCases, added);
        var result = await suiteRepository.UpdateAsync(updated, CancellationToken);

        result.Evaluators.Should().HaveCount(1);
        result.Evaluators.Should().Contain(e => e.Id == exact.Id);
        result.Evaluators.Should().NotContain(e => e.Id == agentic.Id);

        var retrieved = await suiteRepository.GetAsync(result.Id, CancellationToken);
        retrieved.Evaluators.Should().HaveCount(1);
        retrieved.Evaluators.Should().Contain(e => e.Id == exact.Id);
    }

    [TestMethod]
    public async Task AddAsync_WithSingleEvaluator_PersistsCorrectly()
    {
        IServiceProvider services = GetServices();
        var suiteRepository = services.GetRequiredService<IRepository<ITestSuite>>();
        var evaluatorRepository = services.GetRequiredService<IRepository<IEvaluator>>();
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var testCaseGenerator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var project = await projectGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(project), CancellationToken);

        var suite = suiteFactory("Single eval suite", agent, [exact], [testCase]);
        var added = await suiteRepository.AddAsync(suite, CancellationToken);

        added.Evaluators.Should().HaveCount(1);
        added.Evaluators.Should().Contain(e => e.Id == exact.Id);

        var retrieved = await suiteRepository.GetAsync(added.Id, CancellationToken);
        retrieved.Evaluators.Should().HaveCount(1);
        retrieved.Evaluators.Single().Id.Should().Be(exact.Id);
    }
}
