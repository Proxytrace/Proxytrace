namespace Trsr.Domain.Evaluator.Internal;

internal class JsonSchemaMatchEvaluatorGenerator : EvaluatorGeneratorBase<IJsonSchemaMatchEvaluator>
{
    private readonly IJsonSchemaMatchEvaluator.CreateNew factory;

    public JsonSchemaMatchEvaluatorGenerator(
        IJsonSchemaMatchEvaluator.CreateNew factory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
    }

    public override Task<IJsonSchemaMatchEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(factory("""{"type": "object"}"""));
}
