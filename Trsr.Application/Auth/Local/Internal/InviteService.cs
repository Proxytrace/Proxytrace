using System.Security.Cryptography;
using Trsr.Domain;
using Trsr.Domain.Invite;
using Trsr.Domain.User;

namespace Trsr.Application.Auth.Local.Internal;

internal sealed class InviteService : IInviteService
{
    private const int TokenBytes = 32;
    private static readonly TimeSpan Ttl = TimeSpan.FromDays(7);

    private readonly IInviteRepository invites;
    private readonly IUserRepository users;
    private readonly IInvite.CreateNew createInvite;
    private readonly IUser.CreateNew createUser;
    private readonly IPasswordService passwords;
    private readonly ITransaction transaction;

    public InviteService(
        IInviteRepository invites,
        IUserRepository users,
        IInvite.CreateNew createInvite,
        IUser.CreateNew createUser,
        IPasswordService passwords,
        ITransaction transaction)
    {
        this.invites = invites;
        this.users = users;
        this.createInvite = createInvite;
        this.createUser = createUser;
        this.passwords = passwords;
        this.transaction = transaction;
    }

    public async Task<IInvite> CreateAsync(string email, UserRole role, IUser invitedBy, CancellationToken cancellationToken = default)
    {
        var token = GenerateToken();
        var invite = createInvite(email, role, token, DateTimeOffset.UtcNow + Ttl, invitedBy);
        return await invite.AddAsync(cancellationToken);
    }

    public async Task<IInvite?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var invite = await invites.FindByTokenAsync(token, cancellationToken);
        if (invite is null) return null;
        if (invite.IsConsumed) return null;
        if (invite.IsExpired(DateTimeOffset.UtcNow)) return null;
        return invite;
    }

    public Task<IUser?> ConsumeAsync(string token, string password, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync<IUser?>(async () =>
        {
            var invite = await GetByTokenAsync(token, cancellationToken);
            if (invite is null) return null;

            // Hash against a draft user (PasswordHasher<IUser> in current MS implementation
            // doesn't actually read user state, but contract leaves room — use a draft for safety).
            var draft = createUser(invite.Email, externalSubject: null, passwordHash: "placeholder", role: invite.Role);
            var hash = passwords.Hash(draft, password);
            var withHash = createUser(invite.Email, externalSubject: null, passwordHash: hash, role: invite.Role);
            var saved = await withHash.AddAsync(cancellationToken);

            await invite.MarkConsumedAsync(cancellationToken);
            return saved;
        });

    private static string GenerateToken()
    {
        var bytes = new byte[TokenBytes];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
