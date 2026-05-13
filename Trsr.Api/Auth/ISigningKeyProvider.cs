namespace Trsr.Api.Auth;

internal interface ISigningKeyProvider
{
    string EnsureSigningKey(string? configured);
}