using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Project.Internal;

internal record Project : DomainEntity, IProject
{
    public string Name { get; }
    public Guid Organization { get; set; }

    public Project(string name, Guid organization)
    {
        Name = name;
        Organization = organization;
    }

    public Project(IProjectData existing) : base(existing)
    {
        Name = existing.Name;
        Organization = existing.Organization;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }
        
        if (string.IsNullOrWhiteSpace(Name))
        {
            yield return Validation.NotNullOrWhiteSpace(Name, nameof(Name));
        }
        
        if (Organization == Guid.Empty)
        {
            yield return Validation.NotDefault(Organization, nameof(Organization));
        }
    }
}

