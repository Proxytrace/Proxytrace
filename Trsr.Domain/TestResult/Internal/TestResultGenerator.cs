using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult.Internal;

internal class TestResultGenerator : DomainEntityGenerator<ITestResult>, ITestResultGenerator
{
    private readonly ITestResult.CreateNew factory;
    private readonly IDomainEntityGenerator<ITestCase> testCaseGenerator;
    private readonly IDomainObjectGenerator<IEvaluation> evaluationGenerator;
    private readonly IDomainObjectGenerator<AssistantMessage> assistantMessageGenerator;

    public TestResultGenerator(
        ITestResult.CreateNew factory,
        IRepository<ITestResult> repository,
        IDomainEntityGenerator<ITestCase> testCaseGenerator,
        IDomainObjectGenerator<IEvaluation> evaluationGenerator,
        IDomainObjectGenerator<AssistantMessage> assistantMessageGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.testCaseGenerator = testCaseGenerator;
        this.evaluationGenerator = evaluationGenerator;
        this.assistantMessageGenerator = assistantMessageGenerator;
    }

    public override async Task<ITestResult> GenerateAsync(CancellationToken cancellationToken = default)
    {
        IReadOnlyCollection<IEvaluation> evaluations = await Enumerable.Range(0, random.Int(1, 3))
            .Select(_ => evaluationGenerator.CreateAsync(cancellationToken))
            .Await();

        return factory(
            testCase: await testCaseGenerator.CreateAsync(cancellationToken),
            actualResponse: await assistantMessageGenerator.CreateAsync(cancellationToken),
            evaluations: evaluations);
    }

    public async Task<ITestResult> CreateAsync(ITestCase testCase, CancellationToken cancellationToken = default)
    {
        IReadOnlyCollection<IEvaluation> evaluations = await Enumerable.Range(0, random.Int(1, 3))
            .Select(_ => evaluationGenerator.CreateAsync(cancellationToken))
            .Await();

        var result = factory(
            testCase: testCase,
            actualResponse: await assistantMessageGenerator.CreateAsync(cancellationToken),
            evaluations: evaluations);
        return await repository.AddAsync(result, cancellationToken);
    }
}
