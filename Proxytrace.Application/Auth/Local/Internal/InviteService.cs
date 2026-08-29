using Nordstein.Core.Common.Async;
using System.Security.Cryptography;
using Nordstein.Core.Common.Security;
using Proxytrace.Domain;
using Proxytrace.Domain.Invite;
using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth.Local.Internal;

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
    private readonly ISecretHasher hasher;

    /// <summary>
    /// Initializes a new instance of the <see cref="InviteService"/> class.
    /// </summary>
    public InviteService(
        IInviteRepository invites,
        IUserRepository users,
        IInvite.CreateNew createInvite,
        IUser.CreateNew createUser,
        IPasswordService passwords,
        ITransaction transaction,
        ISecretHasher hasher)
    {
        this.invites = invites;
        this.users = users;
        this.createInvite = createInvite;
        this.createUser = createUser;
        this.passwords = passwords;
        this.transaction = transaction;
        this.hasher = hasher;
    }

    /// <summary>
    /// Creates asynchronously.
    /// </summary>
    public async Task<InviteCreated> CreateAsync(
        string email,
        UserRole role,
        IUser invitedBy,
        CancellationToken cancellationToken = default)
    {
        // Persist only the hash of the token; the raw value is returned once so the caller can build
        // the invite link, and is unrecoverable afterwards.
        var rawToken = GenerateToken();
        var invite = createInvite(email, role, hasher.Hash(rawToken), DateTimeOffset.UtcNow + Ttl, invitedBy);
        var saved = await invite.AddAsync(cancellationToken);
        return new InviteCreated(saved, rawToken);
    }

    /// <summary>
    /// Gets the by token asynchronously.
    /// </summary>
    public async Task<IInvite?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var invite = await invites.FindByTokenAsync(token, cancellationToken);
        if (invite is null)
        {
            return null;
        }

        if (invite.IsConsumed)
        {
            return null;
        }

        return invite.IsExpired(DateTimeOffset.UtcNow) ? null : invite;
    }

    /// <summary>
    /// Consume asynchronously.
    /// </summary>
    public Task<IUser?> ConsumeAsync(string token, string password, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync<IUser?>(async () =>
        {
            var invite = await GetByTokenAsync(token, cancellationToken);
            if (invite is null)
            {
                return null;
            }

            // Hash against a draft user (PasswordHasher<IUser> in current MS implementation
            // doesn't actually read user state, but contract leaves room — use a draft for safety).
            var draft = createUser(
                invite.Email, 
                externalSubject: null, 
                passwordHash: "placeholder", 
                role: invite.Role);
            
            var hash = passwords.Hash(draft, password);
            var withHash = createUser(
                invite.Email, 
                externalSubject: null,
                passwordHash: hash, 
                role: invite.Role);
            
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
