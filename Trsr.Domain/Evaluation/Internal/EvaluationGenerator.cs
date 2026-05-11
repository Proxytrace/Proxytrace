using Trsr.Common.Random;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Internal;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluation.Internal;

internal class EvaluationGenerator : DomainObjectGenerator<IEvaluation>
{
    private readonly IDomainEntityGenerator<IEvaluator> evaluatorGenerator;
    private readonly IEvaluation.Create factory;

    public EvaluationGenerator(
        IRandom random,
        IDomainEntityGenerator<IEvaluator> evaluatorGenerator,
        IEvaluation.Create factory) : base(random)
    {
        this.evaluatorGenerator = evaluatorGenerator;
        this.factory = factory;
    }

    public override async Task<IEvaluation> CreateAsync(CancellationToken cancellationToken = default)
    {
        IEvaluator evaluator = await evaluatorGenerator.GetOrCreateAsync(cancellationToken);
        return factory(evaluator, Random.Enum<EvaluationScore>(), Random.String());
    }
}