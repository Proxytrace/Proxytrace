using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Application.Demo;
using Proxytrace.Common.Hosting;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    private readonly KioskOptions kioskOptions;
    private readonly KioskEndpointOptions kioskEndpoint;
    private readonly IAppVersion appVersion;

    public ConfigController(KioskOptions kioskOptions, KioskEndpointOptions kioskEndpoint, IAppVersion appVersion)
    {
        this.kioskOptions = kioskOptions;
        this.kioskEndpoint = kioskEndpoint;
        this.appVersion = appVersion;
    }

    [HttpGet]
    [AllowAnonymous]
    public object Get() => new
    {
        kiosk = kioskOptions.Enabled,

        // Interactive = full read-write. Always true outside kiosk; in kiosk only when a
        // real LLM endpoint is configured (unlocks runs, evaluations, proposals, CRUD).
        interactive = !kioskOptions.Enabled || kioskEndpoint.IsConfigured,

        // Anonymous version exposure is a conscious choice for a self-hosted product
        // (documented in the operator manual); the SPA shows it in the about/footer area.
        version = appVersion.Version,
    };
}
