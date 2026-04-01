using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.TestRun.Internal;

internal class TestRunGenerator : DomainEntityGenerator<ITestRun>
{
    private readonly ITestRun.CreateNew factory;
    private readonly IDomainEntityGenerator<IAgent> agentGenerator;
    private readonly IDomainEntityGenerator<ITestResult> testResultGenerator;

    public TestRunGenerator(
        ITestRun.CreateNew factory,
        IRepository<ITestRun> repository,
        IDomainEntityGenerator<IAgent> agentGenerator,
        IDomainEntityGenerator<ITestResult> testResultGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.agentGenerator = agentGenerator;
        this.testResultGenerator = testResultGenerator;
    }

    public override async Task<ITestRun> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var agent = await agentGenerator.GetOrCreateAsync(cancellationToken);
        var testResult = await testResultGenerator.CreateAsync(cancellationToken);
        return factory(
            timestamp: DateTimeOffset.UtcNow,
            agent: agent,
            testResults: [testResult]);
    }
}
