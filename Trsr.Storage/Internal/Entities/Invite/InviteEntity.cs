using Trsr.Domain.Invite;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.Invite;

[StoredDomainEntity(typeof(Trsr.Domain.Invite.IInvite))]
internal record InviteEntity : Entity
{
    public required string Email { get; init; }
    public required UserRole Role { get; init; }
    public required string Token { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public DateTimeOffset? ConsumedAt { get; init; }
    public required Guid InvitedBy { get; init; }
}
