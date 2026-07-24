using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Proxytrace.Proxy.Controllers;

namespace Proxytrace.Api.Kiosk;

/// <summary>
/// Controls whether the kiosk-showcase OpenAI proxy controller is mounted as an MVC application part.
///
/// The ASP.NET Core Web SDK auto-generates
/// <c>[assembly: ApplicationPart("Proxytrace.Proxy")]</c> into <c>Proxytrace.Api</c> at build time
/// because the referenced <c>Proxytrace.Proxy</c> library contains MVC controllers (verified in
/// <c>obj/*/Proxytrace.Api.MvcApplicationPartsAssemblyInfo.cs</c>). Left untouched, that would mount
/// <see cref="OpenAiProxyController"/> — and its <c>openai/v1/{**path}</c> route — in EVERY mode. That
/// breaks the kiosk gate's zero-behaviour-change guarantee: in production and in kiosk-without-endpoint
/// the route must be ABSENT (404), and the controller's pipeline dependencies (<c>IApiKeyResolver</c>,
/// <c>IIngestionStream</c>, …) are only registered in kiosk+endpoint mode, so a mounted-but-unresolvable
/// controller would 500 rather than 404.
///
/// So we take explicit control of the auto-added part: mount it only in kiosk+endpoint mode; strip it
/// in every other mode. This is the single source of truth shared by <c>Program.cs</c> and its tests.
/// </summary>
internal static class KioskProxyMounting
{
    /// <summary>
    /// Ensures the proxy controller's application part is present when <paramref name="mount"/> is true
    /// and absent otherwise, de-duplicating against the SDK's auto-added part.
    /// </summary>
    public static void Apply(ApplicationPartManager partManager, bool mount)
    {
        ArgumentNullException.ThrowIfNull(partManager);

        var proxyAssembly = typeof(OpenAiProxyController).Assembly;
        var existingPart = partManager.ApplicationParts
            .OfType<AssemblyPart>()
            .FirstOrDefault(part => part.Assembly == proxyAssembly);

        if (mount)
        {
            // Present already (SDK auto-add) — leave it; only add when a host did not auto-discover it.
            if (existingPart is null)
            {
                partManager.ApplicationParts.Add(new AssemblyPart(proxyAssembly));
            }
        }
        else if (existingPart is not null)
        {
            // Strip the SDK's auto-added part so the proxy route stays absent (404) outside kiosk+endpoint.
            partManager.ApplicationParts.Remove(existingPart);
        }
    }
}
