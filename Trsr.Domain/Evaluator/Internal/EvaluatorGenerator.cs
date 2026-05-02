using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Evaluator.Internal;

internal class EvaluatorGenerator : DomainEntityGenerator<IEvaluator>
{
    private readonly IExactMatchEvaluator.CreateNew factory;

    public EvaluatorGenerator(
        IExactMatchEvaluator.CreateNew factory,
        IRepository<IEvaluator> repository,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
    }

    public override Task<IEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IEvaluator>(factory());
}
