using Trsr.Domain.Project;

namespace Trsr.Domain.Evaluator.Internal;

// IHelpfulnessEvaluator.CreateNew has an incorrect return type (ICustomEvaluator), so the
// implementation is constructed directly rather than through the delegate.
internal class HelpfulnessEvaluatorGenerator : EvaluatorGeneratorBase<IHelpfulnessEvaluator>
{
    private readonly IDomainEntityGenerator<IProject> projectGenerator;
    private readonly IHelpfulnessEvaluator.CreateNew factory;

    public HelpfulnessEvaluatorGenerator(
        IDomainEntityGenerator<IProject> projectGenerator,
        IHelpfulnessEvaluator.CreateNew factory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.projectGenerator = projectGenerator;
        this.factory = factory;
    }

    public override async Task<IHelpfulnessEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
    {
        IProject project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        return factory(project);
    }
}
