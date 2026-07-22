#if !DEBUG
using System.Reflection;
using System.Text;
using AwesomeAssertions;
using Proxytrace.Api.Controllers;
using Proxytrace.Application.Setup;

namespace Proxytrace.Api.Tests;

/// <summary>
/// Release-only safety guard: the developer debug-login back-door (see <c>docs/debug_api.md</c>) is
/// gated by <c>#if DEBUG</c> and MUST be entirely absent from a Release build.
/// <para>
/// This whole class is compiled only in a non-Debug configuration (<c>#if !DEBUG</c>), so it runs
/// under <c>dotnet test -c Release</c> — which also builds the product assembly under test in
/// Release — and is skipped by a normal Debug test run (the back-door is intentionally present in
/// Debug). If anyone removes the <c>#if DEBUG</c> guard around the seeder, the credential leaks into
/// the shipped binary and these tests fail.
/// </para>
/// </summary>
[TestClass]
public sealed class ReleaseBackdoorClosedTests
{
    // Anchor on a public type so we introspect the real, compiled Proxytrace.Api assembly under test.
    private static Assembly ApiAssembly => typeof(TraceyChatController).Assembly;

    // The back-door identity is shared with the Application layer (SetupService excludes it from the
    // first-run check), so that assembly must be free of it in Release too.
    private static Assembly ApplicationAssembly => typeof(ISetupService).Assembly;

    [TestMethod]
    public void DebugBackDoorAccount_IsCompiledOutOfReleaseBuild()
    {
        ApplicationAssembly
            .GetType("Proxytrace.Application.Setup.DebugBackDoorAccount", throwOnError: false)
            .Should().BeNull("the back-door account identity must be excluded from Release builds (#if DEBUG)");
    }

    [TestMethod]
    public void DebugLoginSeeder_IsCompiledOutOfReleaseBuild()
    {
        ApiAssembly
            .GetType("Proxytrace.Api.Debug.DebugLoginSeederHostedService", throwOnError: false)
            .Should().BeNull("the debug-login back-door must be excluded from Release builds (#if DEBUG)");
    }

    [TestMethod]
    public void NoDebugOnlyTypes_ShipInReleaseBuild()
    {
        ApiAssembly.GetTypes()
            .Where(t => t.Namespace == "Proxytrace.Api.Debug")
            .Should().BeEmpty("nothing under the debug-only Proxytrace.Api/Debug namespace should ship in Release");
    }

    [TestMethod]
    public void BackdoorCredentialLiterals_AreNotEmbeddedInReleaseAssembly()
    {
        // .NET stores string literals as UTF-16 in the assembly's metadata; scan the raw bytes so the
        // guard does not depend on any type still existing to reference them.
        foreach (var assembly in new[] { ApiAssembly, ApplicationAssembly })
        {
            byte[] assemblyBytes = File.ReadAllBytes(assembly.Location);

            foreach (var secret in new[] { "debug@proxytrace.dev", "#Proxy420!" })
            {
                IndexOf(assemblyBytes, Encoding.Unicode.GetBytes(secret))
                    .Should().BeLessThan(0, $"the back-door secret '{secret}' must not be present in the shipped Release assembly {assembly.GetName().Name}");
            }
        }
    }

    private static int IndexOf(byte[] haystack, byte[] needle)
    {
        for (var i = 0; i + needle.Length <= haystack.Length; i++)
        {
            var match = true;
            for (var j = 0; j < needle.Length; j++)
            {
                if (haystack[i + j] != needle[j])
                {
                    match = false;
                    break;
                }
            }

            if (match)
            {
                return i;
            }
        }

        return -1;
    }
}
#endif
