using System.ComponentModel.DataAnnotations;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.User;

namespace Proxytrace.Domain.Invite.Internal;

internal record Invite : DomainEntity<IInvite>, IInvite
{
    public string Email { get; }
    public UserRole Role { get; }
    public string Token { get; }
    public DateTimeOffset ExpiresAt { get; }
    public DateTimeOffset? ConsumedAt { get; private init; }
    public IUser InvitedBy { get; }

    public Invite(
        string email,
        UserRole role,
        string token,
        DateTimeOffset expiresAt,
        IUser invitedBy,
        IRepository<IInvite> repository) : base(repository)
    {
        Email = email;
        Role = role;
        Token = token;
        ExpiresAt = expiresAt;
        InvitedBy = invitedBy;
    }

    public Invite(
        string email,
        UserRole role,
        string token,
        DateTimeOffset expiresAt,
        DateTimeOffset? consumedAt,
        IUser invitedBy,
        IDomainEntityData existing,
        IRepository<IInvite> repository) : base(existing, repository)
    {
        Email = email;
        Role = role;
        Token = token;
        ExpiresAt = expiresAt;
        ConsumedAt = consumedAt;
        InvitedBy = invitedBy;
    }

    public Task<IInvite> MarkConsumedAsync(CancellationToken cancellationToken = default)
        => ApplyAsync(this with { ConsumedAt = DateTimeOffset.UtcNow }, cancellationToken);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        yield return Validation.NotNullOrWhiteSpace(Email);
        yield return Validation.NotNullOrWhiteSpace(Token);
        yield return Validation.Defined(Role);
        yield return Validation.NotBefore(ExpiresAt, CreatedAt);

        foreach (var result in InvitedBy.Validate(validationContext))
        {
            yield return result;
        }
    }
}
