using Trsr.Domain.Project;

namespace Trsr.Storage.Internal.Entities.Project;

[StoredDomainEntity(typeof(IProject))]
[Cacheable]
internal record ProjectEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.Project.IProject.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.Project.IProject.SystemEndpoint"/>
    /// </summary>
    public required Guid SystemEndpoint { get; init; }

    /// <summary>
    /// Junction rows for the project's members.
    /// </summary>
    public required ICollection<ProjectUserEntity> ProjectUsers { get; init; }
}
