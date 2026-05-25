using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth.Local;

public interface ILocalTokenIssuer
{
    LocalTokenResult Issue(IUser user);
}

public sealed record LocalTokenResult(string Token, DateTimeOffset ExpiresAt);

public sealed class LocalAuthOptions
{
    public const string SectionName = "Authentication:Local";
    public string SigningKey { get; init; } = string.Empty;
    public string Issuer { get; init; } = "proxytrace-local";
    public string Audience { get; init; } = "proxytrace-api";
    public TimeSpan TokenLifetime { get; init; } = TimeSpan.FromDays(7);
}
