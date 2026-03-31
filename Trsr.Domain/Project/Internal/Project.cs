using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Organization;

namespace Trsr.Domain.Project.Internal;

internal record Project : DomainEntity, IProject
{
    public string Name { get; }
    public IOrganization Organization { get; }

    public Project(string name, IOrganization organization)
    {
        Name = name;
        Organization = organization;
    }

    public Project(string name, IOrganization organization, IDomainEntityData existing) : base(existing)
    {
        Name = name;
        Organization = organization;
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

        foreach (var result in Organization.Validate(validationContext))
        {
            yield return result;
        }
    }
}
