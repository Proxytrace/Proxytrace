using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Project;
using Trsr.Domain.Search;

namespace Trsr.Domain.ProjectSearchSettings.Internal;

internal class ProjectSearchSettingsGenerator : DomainEntityGenerator<IProjectSearchSettings>
{
    private readonly IProjectSearchSettings.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;

    public ProjectSearchSettingsGenerator(
        IProjectSearchSettings.CreateNew factory,
        IRepository<IProjectSearchSettings> repository,
        IDomainEntityGenerator<IProject> projectGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
    }

    public override async Task<IProjectSearchSettings> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.CreateAsync(cancellationToken);
        return factory(
            project: project,
            enabled: true,
            indexedKinds: Enum.GetValues<SearchKind>(),
            autoReindexOnChange: true,
            snippetLength: 160);
    }
}
