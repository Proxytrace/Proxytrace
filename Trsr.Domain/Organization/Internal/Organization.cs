using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.User;

namespace Trsr.Domain.Organization.Internal;

internal record Organization : DomainEntity<IOrganization>, IOrganization
{
    public string Name { get; }
    public IReadOnlyCollection<IUser> Users { get; }

    public Organization(
        string name,
        IReadOnlyCollection<IUser>? users,
        IRepository<IOrganization> repository) : base(repository)
    {
        Name = name;
        Users = users ?? [];
    }

    public Organization(
        string name,
        IReadOnlyCollection<IUser> users,
        IDomainEntityData existing,
        IRepository<IOrganization> repository) : base(existing, repository)
    {
        Name = name;
        Users = users;
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

    public virtual bool Equals(Organization? other) 
        => base.Equals(other) && Name == other.Name && Users.SequenceEqual(other.Users);

    public override int GetHashCode() 
        => HashCode.Combine(base.GetHashCode(), Name, Users);
}
