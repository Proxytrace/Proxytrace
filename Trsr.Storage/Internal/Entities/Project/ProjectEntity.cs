namespace Trsr.Storage.Internal.Entities.Project;

[StoredDomainEntity(typeof(Trsr.Domain.Project.IProject))]
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
}
