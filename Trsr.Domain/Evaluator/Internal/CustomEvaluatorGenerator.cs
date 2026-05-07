using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Evaluator.Internal;

internal class CustomEvaluatorGenerator : EvaluatorGeneratorBase<ICustomEvaluator>
{
    private readonly ICustomEvaluator.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;
    private readonly IDomainObjectGenerator<IPromptTemplate> promptGenerator;

    public CustomEvaluatorGenerator(
        ICustomEvaluator.CreateNew factory,
        IDomainEntityGenerator<IProject> projectGenerator,
        IDomainObjectGenerator<IPromptTemplate> promptGenerator,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
        this.promptGenerator = promptGenerator;
    }

    public override async Task<ICustomEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        var prompt = await promptGenerator.CreateAsync(cancellationToken);
        return factory(prompt, project);
    }
}
