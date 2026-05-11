using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.User;

namespace Trsr.Domain.Invite.Internal;

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

        foreach (var __r in Validation.NotNullOrWhiteSpace(Email).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.NotNullOrWhiteSpace(Token).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.Defined(Role).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.NotBefore(ExpiresAt, CreatedAt, nameof(ExpiresAt)).AsEnumerable()) yield return __r;

        if (InvitedBy is null)
        {
            yield return new ValidationResult($"{nameof(InvitedBy)} must not be null.", new[] { nameof(InvitedBy) });
        }
        else
        {
            foreach (var result in InvitedBy.Validate(validationContext))
            {
                yield return result;
            }
        }
    }
}
