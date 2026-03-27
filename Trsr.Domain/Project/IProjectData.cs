namespace Trsr.Domain.Project;

public interface IProjectData : IDomainEntityData
{
    public string Name { get; }
    public Guid Organization { get; set; }
}