using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.TestSuites;
using Proxytrace.Domain;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.TestCase;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/test-cases")]
public class TestCasesController : ControllerBase
{
    private readonly IRepository<ITestCase> repository;

    public TestCasesController(IRepository<ITestCase> repository)
    {
        this.repository = repository;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestCaseDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken)) return NotFound();
        var tc = await repository.GetAsync(id, cancellationToken);
        return new TestCaseDto(
            tc.Id,
            tc.Input.Messages.Select(m => new TestSuiteMessageDto(m.Role.ToString().ToLower(), GetText(m))).ToArray(),
            new TestSuiteMessageDto("assistant", string.Concat(tc.ExpectedOutput.Contents.Select(c => c.Text ?? ""))));
    }

    private static string GetText(Message m) => m switch
    {
        UserMessage u => string.Concat(u.Contents.Select(c => c.Text ?? "")),
        AssistantMessage a => string.Concat(a.Contents.Select(c => c.Text ?? "")),
        SystemMessage s => string.Concat(s.Contents.Select(c => c.Text ?? "")),
        ToolMessage t => t.Contents.Count > 1 ? t.Contents[1].Text ?? "" : "",
        _ => ""
    };
}
