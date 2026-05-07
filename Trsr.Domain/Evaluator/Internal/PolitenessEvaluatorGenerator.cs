using Trsr.Domain.Project;

namespace Trsr.Domain.Evaluator.Internal;

internal class PolitenessEvaluatorGenerator : EvaluatorGeneratorBase<IPolitenessEvaluator>
{
    private readonly IPolitenessEvaluator.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;

    public PolitenessEvaluatorGenerator(
        IPolitenessEvaluator.CreateNew factory,
        IDomainEntityGenerator<IProject> projectGenerator,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
    }

    public override async Task<IPolitenessEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
    {
        IProject project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        return factory(project);
    }
}
