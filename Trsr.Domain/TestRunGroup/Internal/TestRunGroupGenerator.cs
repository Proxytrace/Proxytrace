using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.TestSuite;

namespace Trsr.Domain.TestRunGroup.Internal;

internal class TestRunGroupGenerator : DomainEntityGenerator<ITestRunGroup>
{
    private readonly ITestRunGroup.CreateNew factory;
    private readonly IDomainEntityGenerator<ITestSuite> suiteGenerator;

    public TestRunGroupGenerator(
        ITestRunGroup.CreateNew factory,
        IRepository<ITestRunGroup> repository,
        IDomainEntityGenerator<ITestSuite> suiteGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.suiteGenerator = suiteGenerator;
    }

    public override async Task<ITestRunGroup> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var suite = await suiteGenerator.GetOrCreateAsync(cancellationToken);
        return factory(suite);
    }
}
