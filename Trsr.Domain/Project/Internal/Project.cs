using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Project.Internal;

internal record Project : DomainEntity<IProject>, IProject
{
    public string Name { get; }
    public IModelEndpoint SystemEndpoint { get; }

    public Project(
        string name,
        IModelEndpoint systemEndpoint,
        IRepository<IProject> repository) : base(repository)
    {
        Name = name;
        SystemEndpoint = systemEndpoint;
    }

    public Project(
        string name,
        IModelEndpoint systemEndpoint,
        IDomainEntityData existing,
        IRepository<IProject> repository) : base(existing, repository)
    {
        Name = name;
        SystemEndpoint = systemEndpoint;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (string.IsNullOrWhiteSpace(Name))
        {
            yield return Validation.NotNullOrWhiteSpace(Name);
        }
        
        foreach (var result in SystemEndpoint.Validate(validationContext))
        {
            yield return result;
        }
    }
}
