using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.User.Internal;

internal record User : DomainEntity<IUser>, IUser
{
    public string Name { get; }
    public string Email { get; }
    public string ExternalSubject { get; }
    public UserRole Role { get; private init; }

    public User(
        string name,
        string email,
        string externalSubject,
        UserRole role,
        IRepository<IUser> repository) : base(repository)
    {
        Name = name;
        Email = email;
        ExternalSubject = externalSubject;
        Role = role;
    }

    public User(
        string name,
        string email,
        string externalSubject,
        UserRole role,
        IDomainEntityData existing,
        IRepository<IUser> repository) : base(existing, repository)
    {
        Name = name;
        Email = email;
        ExternalSubject = externalSubject;
        Role = role;
    }

    public Task<IUser> ChangeRole(UserRole role, CancellationToken cancellationToken = default)
        => Role == role
            ? Task.FromResult<IUser>(this)
            : ApplyAsync(this with { Role = role }, cancellationToken);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var __r in Validation.NotNullOrWhiteSpace(Name).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.NotNullOrWhiteSpace(Email).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.NotNullOrWhiteSpace(ExternalSubject).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.Defined(Role).AsEnumerable()) yield return __r;
    }
}
