using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.User.Internal;

internal record User : DomainEntity<IUser>, IUser
{
    public string Email { get; }
    public string? ExternalSubject { get; }
    public string? PasswordHash { get; private init; }
    public UserRole Role { get; private init; }

    public User(
        string email,
        string? externalSubject,
        string? passwordHash,
        UserRole role,
        IRepository<IUser> repository) : base(repository)
    {
        Email = email;
        ExternalSubject = externalSubject;
        PasswordHash = passwordHash;
        Role = role;
    }

    public User(
        string email,
        string? externalSubject,
        string? passwordHash,
        UserRole role,
        IDomainEntityData existing,
        IRepository<IUser> repository) : base(existing, repository)
    {
        Email = email;
        ExternalSubject = externalSubject;
        PasswordHash = passwordHash;
        Role = role;
    }

    public Task<IUser> ChangeRole(UserRole role, CancellationToken cancellationToken = default)
        => Role == role
            ? Task.FromResult<IUser>(this)
            : ApplyAsync(this with { Role = role }, cancellationToken);

    public Task<IUser> ChangePasswordHash(string passwordHash, CancellationToken cancellationToken = default)
        => ApplyAsync(this with { PasswordHash = passwordHash }, cancellationToken);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var r in Validation.NotNullOrWhiteSpace(Email).AsEnumerable()) yield return r;
        foreach (var r in Validation.Defined(Role).AsEnumerable()) yield return r;
        
        if (string.IsNullOrWhiteSpace(ExternalSubject) && string.IsNullOrWhiteSpace(PasswordHash))
        {
            yield return new ValidationResult(
                "User must have either ExternalSubject (OIDC) or PasswordHash (local).",
                [nameof(ExternalSubject), nameof(PasswordHash)]);
        }
    }
}
