using System.Text.RegularExpressions;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
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
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        IModelEndpoint? endpoint = null;

        return kind switch
        {
            EvaluatorKind.ExactMatch =>
                services.GetRequiredService<IExactMatchEvaluator.CreateNew>()(),
            EvaluatorKind.NumericMatch =>
                services.GetRequiredService<INumericMatchEvaluator.CreateNew>()(new Regex(@"\d+(?:\.\d+)?"), 0.01m),
            EvaluatorKind.JsonSchemaMatch =>
                services.GetRequiredService<IJsonSchemaMatchEvaluator.CreateNew>()("""{"type": "object"}"""),
            EvaluatorKind.Custom =>
                services.GetRequiredService<ICustomEvaluator.CreateNew>()(
                    new SystemMessage([Content.FromText("Evaluate.")]),
                    endpoint = await endpointGenerator.GetOrCreateAsync(CancellationToken)),
            EvaluatorKind.Helpfulness =>
                services.GetRequiredService<IHelpfulnessEvaluator.CreateNew>()(
                    endpoint ?? await endpointGenerator.GetOrCreateAsync(CancellationToken)),
            EvaluatorKind.Politeness =>
                services.GetRequiredService<IPolitenessEvaluator.CreateNew>()(
                    endpoint ?? await endpointGenerator.GetOrCreateAsync(CancellationToken)),
            EvaluatorKind.Safety =>
                services.GetRequiredService<ISafetyClassifier.CreateNew>()(
                    endpoint ?? await endpointGenerator.GetOrCreateAsync(CancellationToken)),
            EvaluatorKind.ToolUsage =>
                services.GetRequiredService<IToolUsageEvaluator.CreateNew>()(
                    endpoint ?? await endpointGenerator.GetOrCreateAsync(CancellationToken)),
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
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var systemMessage = new SystemMessage([Content.FromText("Judge whether the response is correct.")]);

        var endpoint = await endpointGenerator.CreateAsync(CancellationToken);
        var evaluator = factory(systemMessage, endpoint);
        var added = await repository.AddAsync(evaluator, CancellationToken);

        var retrieved = await repository.GetAsync(added.Id, CancellationToken);

        retrieved.Id.Should().Be(added.Id);
        retrieved.Kind.Should().Be(EvaluatorKind.Custom);
        var agentic = retrieved.Should().BeAssignableTo<ICustomEvaluator>().Subject;
        agentic.SystemMessage.Contents.Should().HaveCount(1);
        agentic.SystemMessage.Contents[0].Should().BeEquivalentTo(Content.FromText("Judge whether the response is correct."));
    }

    [TestMethod]
    public async Task GetAllAsync_ReturnsAllEvaluators()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IEvaluator>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();

        var endpoint = await endpointGenerator.CreateAsync(CancellationToken);
        var exact = exactFactory();
        var agentic = agenticFactory(new SystemMessage([Content.FromText("Evaluate.")]), endpoint);
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
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var endpoint = await endpointGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(), CancellationToken);
        var agentic = await evaluatorRepository.AddAsync(
            agenticFactory(new SystemMessage([Content.FromText("Score it.")]), endpoint), CancellationToken);

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
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var endpoint = await endpointGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(), CancellationToken);
        var agentic = await evaluatorRepository.AddAsync(
            agenticFactory(new SystemMessage([Content.FromText("Score it.")]), endpoint), CancellationToken);

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
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();
        var suiteExistingFactory = services.GetRequiredService<ITestSuite.CreateExisting>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var endpoint = await endpointGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(), CancellationToken);
        var agentic = await evaluatorRepository.AddAsync(
            agenticFactory(new SystemMessage([Content.FromText("Score it.")]), endpoint), CancellationToken);

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
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var agenticFactory = services.GetRequiredService<ICustomEvaluator.CreateNew>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();
        var suiteExistingFactory = services.GetRequiredService<ITestSuite.CreateExisting>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var endpoint = await endpointGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(), CancellationToken);
        var agentic = await evaluatorRepository.AddAsync(
            agenticFactory(new SystemMessage([Content.FromText("Score it.")]), endpoint), CancellationToken);

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
        var exactFactory = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var suiteFactory = services.GetRequiredService<ITestSuite.CreateNew>();

        var agent = await agentGenerator.CreateAsync(CancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(CancellationToken);
        var exact = await evaluatorRepository.AddAsync(exactFactory(), CancellationToken);

        var suite = suiteFactory("Single eval suite", agent, [exact], [testCase]);
        var added = await suiteRepository.AddAsync(suite, CancellationToken);

        added.Evaluators.Should().HaveCount(1);
        added.Evaluators.Should().Contain(e => e.Id == exact.Id);

        var retrieved = await suiteRepository.GetAsync(added.Id, CancellationToken);
        retrieved.Evaluators.Should().HaveCount(1);
        retrieved.Evaluators.Single().Id.Should().Be(exact.Id);
    }
}
