using System.ComponentModel.DataAnnotations;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Internal;

namespace Proxytrace.Domain.User.Internal;

internal record User : DomainEntity<IUser>, IUser
{
    public string Email { get; }
    public string? ExternalSubject { get; }
    public string? PasswordHash { get; private init; }
    public UserRole Role { get; private init; }
    public string Language { get; private init; }

    public User(
        string email,
        string? externalSubject,
        string? passwordHash,
        UserRole role,
        string language,
        IRepository<IUser> repository) : base(repository)
    {
        Email = email;
        ExternalSubject = externalSubject;
        PasswordHash = passwordHash;
        Role = role;
        Language = language;
    }

    public User(
        string email,
        string? externalSubject,
        string? passwordHash,
        UserRole role,
        string language,
        IDomainEntityData existing,
        IRepository<IUser> repository) : base(existing, repository)
    {
        Email = email;
        ExternalSubject = externalSubject;
        PasswordHash = passwordHash;
        Role = role;
        Language = language;
    }

    public Task<IUser> ChangeRole(UserRole role, CancellationToken cancellationToken = default)
        => Role == role
            ? Task.FromResult<IUser>(this)
            : ApplyAsync(this with { Role = role }, cancellationToken);

    public Task<IUser> ChangePasswordHash(string passwordHash, CancellationToken cancellationToken = default)
        => ApplyAsync(this with { PasswordHash = passwordHash }, cancellationToken);

    public Task<IUser> ChangeLanguage(string language, CancellationToken cancellationToken = default)
        => Language == language
            ? Task.FromResult<IUser>(this)
            : ApplyAsync(this with { Language = language }, cancellationToken);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        yield return Validation.NotNullOrWhiteSpace(Email);
        yield return Validation.Defined(Role);

        yield return Validation.NotNullOrWhiteSpace(Language);
        if (!SupportedLanguages.IsSupported(Language))
        {
            yield return new ValidationResult(
                $"Language '{Language}' is not a supported UI language.",
                [nameof(Language)]);
        }

        if (string.IsNullOrWhiteSpace(ExternalSubject) && string.IsNullOrWhiteSpace(PasswordHash))
        {
            yield return new ValidationResult(
                "User must have either ExternalSubject (OIDC) or PasswordHash (local).",
                [nameof(ExternalSubject), nameof(PasswordHash)]);
        }
    }
}
