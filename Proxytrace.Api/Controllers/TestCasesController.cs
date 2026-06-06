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
    private readonly ITestCase.CreateExisting createExisting;
    private readonly TestSuiteDtoMapper mapper;

    public TestCasesController(
        IRepository<ITestCase> repository,
        ITestCase.CreateExisting createExisting,
        TestSuiteDtoMapper mapper)
    {
        this.repository = repository;
        this.createExisting = createExisting;
        this.mapper = mapper;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestCaseDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var tc = await repository.FindAsync(id, cancellationToken);
        if (tc is null) return NotFound();
        return ToDto(tc);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TestCaseDto>> Update(
        Guid id,
        [FromBody] UpdateTestCaseRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await repository.FindAsync(id, cancellationToken);
        if (existing is null) return NotFound();

        var expected = mapper.BuildAssistantMessage(request.ExpectedOutput);
        var updated = createExisting(existing.Input, expected, existing);
        var saved = await repository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    private TestCaseDto ToDto(ITestCase tc) => new(
        tc.Id,
        tc.Input.Messages.Select(m => new TestSuiteMessageDto(m.Role.ToString().ToLower(), GetText(m))).ToArray(),
        mapper.ToExpectedOutputDto(tc.ExpectedOutput));

    private static string GetText(Message m) => m switch
    {
        UserMessage u => string.Concat(u.Contents.Select(c => c.Text ?? "")),
        AssistantMessage a => string.Concat(a.Contents.Select(c => c.Text ?? "")),
        SystemMessage s => string.Concat(s.Contents.Select(c => c.Text ?? "")),
        ToolMessage t => t.Contents.Count > 1 ? t.Contents[1].Text ?? "" : "",
        _ => ""
    };
}
