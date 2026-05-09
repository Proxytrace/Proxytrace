using Trsr.Domain.Project;

namespace Trsr.Domain;

/// <summary>
/// Something that has a relation to a <see cref="IProject"/>
/// </summary>
public interface IProjectSpecific 
{
    IProject Project { get; }
}