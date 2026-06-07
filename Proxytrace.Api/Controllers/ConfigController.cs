using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Application.Demo;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    private readonly KioskOptions kioskOptions;
    private readonly KioskEndpointOptions kioskEndpoint;

    public ConfigController(KioskOptions kioskOptions, KioskEndpointOptions kioskEndpoint)
    {
        this.kioskOptions = kioskOptions;
        this.kioskEndpoint = kioskEndpoint;
    }

    [HttpGet]
    [AllowAnonymous]
    public object Get() => new
    {
        kiosk = kioskOptions.Enabled,

        // Interactive = full read-write. Always true outside kiosk; in kiosk only when a
        // real LLM endpoint is configured (unlocks runs, evaluations, proposals, CRUD).
        interactive = !kioskOptions.Enabled || kioskEndpoint.IsConfigured,
    };
}
