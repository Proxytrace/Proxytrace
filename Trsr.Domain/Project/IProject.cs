namespace Trsr.Domain.Project;

public interface IProject : IDomainEntity, IProjectData
{
    public delegate IProject CreateNew(string name, Guid organization);
    public delegate IProject CreateExisting(IProjectData existing);
}