using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestSuite;

namespace Trsr.Domain.TestRun.Internal;

internal class TestRunGenerator : DomainEntityGenerator<ITestRun>
{
    private readonly ITestRun.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> endpointGenerator;
    private readonly IDomainEntityGenerator<ITestSuite> suiteGenerator;
    private readonly ITestResultGenerator testResultGenerator;

    public TestRunGenerator(
        ITestRun.CreateNew factory,
        IRepository<ITestRun> repository,
        IDomainEntityGenerator<IModelEndpoint> endpointGenerator,
        IDomainEntityGenerator<ITestSuite> suiteGenerator,
        ITestResultGenerator testResultGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.endpointGenerator = endpointGenerator;
        this.suiteGenerator = suiteGenerator;
        this.testResultGenerator = testResultGenerator;
    }

    public override async Task<ITestRun> GenerateAsync(CancellationToken cancellationToken = default)
    {
        ITestRun run = factory(
            suite: await suiteGenerator.GetOrCreateAsync(cancellationToken),
            endpoint: await endpointGenerator.GetOrCreateAsync(cancellationToken));
        
        int resultCount = random.Int(0, run.Suite.TestCases.Count);
        IReadOnlyCollection<ITestResult> results = await Enumerable.Range(0, resultCount)
            .Select(i => testResultGenerator.CreateAsync(run.Suite.TestCases.ElementAt(i), cancellationToken))
            .ToArray()
            .Await();

        foreach (ITestResult result in results)
        {
            await run.SetTestResult(result, cancellationToken);
        }

        return run;
    }
}
