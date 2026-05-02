using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestSuite;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class TestSuiteValidationTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesTestSuite()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestSuite.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var evaluator = await CreateTestEvaluatorAsync(services);
        var testCase = await CreateTestCaseAsync(services);

        var testSuite = factory("Test Suite", agent, [evaluator], [testCase]);

        testSuite.Should().NotBeNull();
        testSuite.Agent.Should().Be(agent);
        testSuite.Evaluators.Should().ContainSingle().Which.Should().Be(evaluator);
        testSuite.TestCases.Should().ContainSingle();
        testSuite.Id.Should().NotBe(Guid.Empty);
        testSuite.CreatedAt.Should().NotBe(default);
        testSuite.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_WithMultipleEvaluators_StoresAll()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestSuite.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var evaluator1 = await CreateTestEvaluatorAsync(services);
        var evaluator2 = await CreateTestEvaluatorAsync(services);

        var testSuite = factory("Test Suite", agent, [evaluator1, evaluator2], []);

        testSuite.Evaluators.Should().HaveCount(2);
    }

    [TestMethod]
    public async Task CreateNew_WithNullAgent_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestSuite.CreateNew>();
        var evaluator = await CreateTestEvaluatorAsync(services);
        var testCase = await CreateTestCaseAsync(services);

        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Suite", null!, [evaluator], [testCase]);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullEvaluators_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestSuite.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var testCase = await CreateTestCaseAsync(services);

        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Suite", agent, null!, [testCase]);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullTestCases_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestSuite.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var evaluator = await CreateTestEvaluatorAsync(services);

        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Suite", agent, [evaluator], null!);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithEmptyTestCases_CreatesTestSuite()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestSuite.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var evaluator = await CreateTestEvaluatorAsync(services);

        var testSuite = factory("Test Suite", agent, [evaluator], []);

        testSuite.Should().NotBeNull();
        testSuite.TestCases.Should().BeEmpty();
    }

    [TestMethod]
    public async Task CreateNew_WithMultipleTestCases_StoresAllTestCases()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestSuite.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var evaluator = await CreateTestEvaluatorAsync(services);
        var testCase1 = await CreateTestCaseAsync(services);
        var testCase2 = await CreateTestCaseAsync(services);
        var testCase3 = await CreateTestCaseAsync(services);

        var testSuite = factory("Test Suite", agent, [evaluator], [testCase1, testCase2, testCase3]);

        testSuite.TestCases.Should().HaveCount(3);
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesTestSuite()
    {
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<ITestSuite.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>();
        var existing = await generator.CreateAsync(CancellationToken);

        var testSuite = createExisting(existing.Name, existing.Agent, existing.Evaluators, existing.TestCases, existing);

        testSuite.Should().NotBeNull();
        testSuite.Id.Should().Be(existing.Id);
        testSuite.Agent.Should().Be(existing.Agent);
        testSuite.Evaluators.Should().BeEquivalentTo(existing.Evaluators);
        testSuite.CreatedAt.Should().Be(existing.CreatedAt);
        testSuite.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public async Task Id_IsUniqueForEachNewTestSuite()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestSuite.CreateNew>();
        var agent = await CreateTestAgentAsync(services);
        var evaluator = await CreateTestEvaluatorAsync(services);

        var testSuite1 = factory("Test Suite", agent, [evaluator], []);
        var testSuite2 = factory("Test Suite", agent, [evaluator], []);

        testSuite1.Id.Should().NotBe(testSuite2.Id);
    }

    private static async Task<IAgent> CreateTestAgentAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        return await generator.GetOrCreateAsync(default);
    }

    private static async Task<IEvaluator> CreateTestEvaluatorAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>();
        return await generator.GetOrCreateAsync(default);
    }

    private static async Task<ITestCase> CreateTestCaseAsync(IServiceProvider services)
    {
        var generator = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        return await generator.CreateAsync(default);
    }
}
