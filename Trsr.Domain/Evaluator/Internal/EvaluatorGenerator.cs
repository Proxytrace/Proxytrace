using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Project;

namespace Trsr.Domain.Evaluator.Internal;

internal class EvaluatorGenerator : DomainEntityGenerator<IEvaluator>
{
    private readonly IExactMatchEvaluator.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;

    public EvaluatorGenerator(
        IExactMatchEvaluator.CreateNew factory,
        IRepository<IEvaluator> repository,
        IDomainEntityGenerator<IProject> projectGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
    }

    public override async Task<IEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        return factory(project);
    }
}
