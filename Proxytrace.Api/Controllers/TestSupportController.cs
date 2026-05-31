using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Application.TestSupport;

namespace Proxytrace.Api.Controllers;

/// <summary>
/// Test-only endpoints that let the e2e suite control server state. Not part of the product
/// surface — mirrors the existing per-controller <c>/seed</c> endpoints used by the same suite.
/// </summary>
[ApiController]
[Authorize]
[Route("api/test")]
public class TestSupportController : ControllerBase
{
    private readonly ITestDataReset reset;

    public TestSupportController(ITestDataReset reset)
    {
        this.reset = reset;
    }

    /// <summary>
    /// Clears all per-run domain content (agents, traces, evaluators, suites, runs, proposals,
    /// invites) while preserving the setup baseline, so a spec can start from a known state.
    /// </summary>
    [HttpPost("reset")]
    public async Task<IActionResult> Reset(CancellationToken cancellationToken)
    {
        await reset.ResetAsync(cancellationToken);
        return NoContent();
    }
}
