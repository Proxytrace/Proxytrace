using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.User.Internal;

internal record User : DomainEntity, IUser
{
    public string Name { get; }

    public User(string name)
    {
        Name = name;
    }

    public User(string name, IDomainEntityData existing) : base(existing)
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
