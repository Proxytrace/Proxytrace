#if DEBUG
namespace Proxytrace.Application.Setup;

/// <summary>
/// DEBUG-ONLY identity of the developer back-door admin that the API layer seeds on startup
/// (<c>Proxytrace.Api/Debug/DebugLoginSeederHostedService</c>, see <c>docs/debug_api.md</c>).
/// <para>
/// It lives here — one level below the seeder — because two layers need to agree on it: the seeder
/// creates the account, and <see cref="Internal.SetupService"/> must *exclude* it when deciding
/// whether first-run setup has happened. Without that exclusion a fresh debug database looks
/// already-onboarded and the setup wizard is silently skipped.
/// </para>
/// <para>
/// The whole type is wrapped in <c>#if DEBUG</c>, exactly like the seeder, so neither the credential
/// nor any code referencing it exists in a Release build.
/// </para>
/// </summary>
public static class DebugBackDoorAccount
{
    /// <summary>The fixed debug admin email. See <c>docs/debug_api.md</c>.</summary>
    public const string Email = "debug@proxytrace.dev";

    /// <summary>The fixed debug admin password (hashed before storage, like any other user).</summary>
    public const string Password = "#Proxy420!";
}
#endif
