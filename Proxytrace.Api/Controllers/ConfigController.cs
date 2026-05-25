using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Application.Demo;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    private readonly KioskOptions kioskOptions;

    public ConfigController(KioskOptions kioskOptions)
    {
        this.kioskOptions = kioskOptions;
    }

    [HttpGet]
    [AllowAnonymous]
    public object Get() => new
    {
        kiosk = kioskOptions.Enabled,
    };
}
