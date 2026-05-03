using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.User.Internal;

internal record User : DomainEntity<IUser>, IUser
{
    public string Name { get; }

    public User(string name, IRepository<IUser> repository) : base(repository)
    {
        Name = name;
    }

    public User(string name, IDomainEntityData existing, IRepository<IUser> repository) : base(existing, repository)
    {
        Name = name;
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
    }
}
