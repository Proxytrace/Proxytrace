using Trsr.Domain.Project;

namespace Trsr.Domain.Evaluator.Internal;

internal class SafetyClassifierGenerator : EvaluatorGeneratorBase<ISafetyClassifier>
{
    private readonly ISafetyClassifier.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;

    public SafetyClassifierGenerator(
        ISafetyClassifier.CreateNew factory,
        IDomainEntityGenerator<IProject> projectGenerator,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
    }

    public override async Task<ISafetyClassifier> GenerateAsync(CancellationToken cancellationToken = default)
    {
        IProject project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        return factory(project);
    }
}
