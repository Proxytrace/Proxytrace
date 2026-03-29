using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Organization.Internal;

internal record Organization : DomainEntity, IOrganization
{
    public string Name { get; }
    public IReadOnlyCollection<Guid> Users { get; }

    public Organization(string name, IReadOnlyCollection<Guid>? users = null)
    {
        Name = name;
        Users = users ?? [];
    }

    public Organization(IOrganizationData existing) : base(existing)
    {
        Name = existing.Name;
        Users = existing.Users;
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
    }
}

