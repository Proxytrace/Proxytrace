using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Evaluators;
using Trsr.Api.Dto.TestRuns;

namespace Trsr.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/evaluators/{evaluatorId:guid}/test-bench")]
public class EvaluatorTestBenchController : ControllerBase
{
    [HttpGet("load")]
    public Task<ActionResult<EvaluatorTestBenchPayloadDto>> Load(
        Guid evaluatorId,
        [FromQuery] Guid testCaseId,
        CancellationToken cancellationToken)
        => throw new NotImplementedException();

    [HttpPost("run")]
    public Task<ActionResult<EvaluationResultDto>> Run(
        Guid evaluatorId,
        [FromBody] RunEvaluatorOnBenchRequest request,
        CancellationToken cancellationToken)
        => throw new NotImplementedException();
}
