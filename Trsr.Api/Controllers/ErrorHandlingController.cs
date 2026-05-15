using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Error;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/errors")]
public class ErrorHandlingController : ControllerBase
{
    private readonly ILogger<ErrorHandlingController> logger;

    public ErrorHandlingController(ILogger<ErrorHandlingController> logger)
    {
        this.logger = logger;
    }

    [HttpPost]
    public IResult Submit([FromBody] ErrorReportRequest request)
    {
        logger.LogWarning(
            "Client error reported: {Message} [{Type}] at {Url}. Description: {Description}",
            request.Message, request.Type, request.Url, request.Description);

        if (!string.IsNullOrWhiteSpace(request.Stacktrace))
        {
            logger.LogWarning("Stacktrace:\n{Stacktrace}", request.Stacktrace);
        }

        return Results.Ok(new { sent = true });
    }
}
