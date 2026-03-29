using Trsr.Domain.Project;

namespace Trsr.Storage.Internal.Entities.Project;

[StoredDomainEntity(typeof(IProject))]
internal record ProjectEntity : Entity, IProjectData
{
    /// <summary>
    /// <see cref="IProject.Name"/>
    /// </summary>
    public required string Name { get; init; }
    
    /// <summary>
    /// <see cref="IProject.Organization"/>
    /// </summary>
    public required Guid Organization { get; set; }
}

