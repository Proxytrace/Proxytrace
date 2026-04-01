using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult.Internal;

internal class TestResultGenerator : DomainEntityGenerator<ITestResult>
{
    private readonly ITestResult.CreateNew factory;
    private readonly IDomainEntityGenerator<ITestCase> testCaseGenerator;
    private readonly IDomainObjectGenerator<AssistantMessage> assistantMessageGenerator;

    public TestResultGenerator(
        ITestResult.CreateNew factory,
        IRepository<ITestResult> repository,
        IDomainEntityGenerator<ITestCase> testCaseGenerator,
        IDomainObjectGenerator<AssistantMessage> assistantMessageGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.testCaseGenerator = testCaseGenerator;
        this.assistantMessageGenerator = assistantMessageGenerator;
    }

    public override async Task<ITestResult> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
            testCase: await testCaseGenerator.CreateAsync(cancellationToken),
            actualResponse: await assistantMessageGenerator.CreateAsync(cancellationToken),
            evaluation: random.Any<Evaluation>([Evaluation.Pass, Evaluation.Fail, Evaluation.Undecided]));
}
