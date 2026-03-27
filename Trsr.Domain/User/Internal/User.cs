using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.User.Internal;

internal record User : DomainEntity, IUser
{
    public string Name { get; }

    public User(string name)
    {
        Name  = name;
    }

    public User(IUserData existing) : this(existing.Name)
    {
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Name))
        {
            yield return Validation.NotNullOrWhitespace(Name);
        }
    }
}