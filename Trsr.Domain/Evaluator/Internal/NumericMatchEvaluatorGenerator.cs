using System.Text.RegularExpressions;

namespace Trsr.Domain.Evaluator.Internal;

internal class NumericMatchEvaluatorGenerator : EvaluatorGeneratorBase<INumericMatchEvaluator>
{
    private readonly INumericMatchEvaluator.CreateNew factory;

    public NumericMatchEvaluatorGenerator(
        INumericMatchEvaluator.CreateNew factory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
    }

    public override Task<INumericMatchEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(factory(new Regex(@"\d+(?:\.\d+)?"), 0.01m));
}
