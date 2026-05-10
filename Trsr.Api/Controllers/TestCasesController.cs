using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.TestSuites;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/test-cases")]
public class TestCasesController : ControllerBase
{
    [HttpGet("{id:guid}")]
    public Task<ActionResult<TestCaseDto>> Get(Guid id, CancellationToken cancellationToken)
        => throw new NotImplementedException();
}
