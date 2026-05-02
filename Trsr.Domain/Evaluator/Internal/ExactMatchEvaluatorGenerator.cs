namespace Trsr.Domain.Evaluator.Internal;

internal class ExactMatchEvaluatorGenerator : EvaluatorGeneratorBase<IExactMatchEvaluator>
{
    private readonly IExactMatchEvaluator.CreateNew factory;

    public ExactMatchEvaluatorGenerator(
        IExactMatchEvaluator.CreateNew factory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
    }

    public override Task<IExactMatchEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(factory());
}
