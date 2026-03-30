using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestSuite.Internal;

internal class TestSuiteGenerator : DomainEntityGenerator<ITestSuite>
{
    private readonly ITestSuite.CreateNew factory;
    private readonly IDomainEntityGenerator<IAgent> agentGenerator;
    private readonly IDomainEntityGenerator<ITestCase> testCaseGenerator;

    public TestSuiteGenerator(
        ITestSuite.CreateNew factory,
        IRepository<ITestSuite> repository,
        IDomainEntityGenerator<IAgent> agentGenerator,
        IDomainEntityGenerator<ITestCase> testCaseGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.agentGenerator = agentGenerator;
        this.testCaseGenerator = testCaseGenerator;
    }

    public override async Task<ITestSuite> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var agent = await agentGenerator.GetOrCreateAsync(cancellationToken);
        var testCase = await testCaseGenerator.CreateAsync(cancellationToken);
        return factory(agent: agent.Id, testCases: [testCase.Id]);
    }
}
