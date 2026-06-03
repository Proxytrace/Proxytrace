using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Auth.Licensing;
using Proxytrace.Api.Dto.Proposals;
using Proxytrace.Api.Dto.Theories;
using Proxytrace.Application.Optimization;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Domain.Tools;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[RequiresFeature(LicenseFeature.OptimizationProposals)]
[Route("api/theories")]
public class TheoriesController : ControllerBase
{
    private readonly IOptimizationTheoryRepository repository;
    private readonly ITheoryValidationService validationService;
    private readonly ISystemPromptTheory.CreateNew createSystemPrompt;
    private readonly IModelSwitchTheory.CreateNew createModelSwitch;
    private readonly IToolUpdateTheory.CreateNew createToolUpdate;
    private readonly IAgentRepository agents;
    private readonly IRepository<ITestSuite> suites;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly TheoryDtoMapper mapper;

    public TheoriesController(
        IOptimizationTheoryRepository repository,
        ITheoryValidationService validationService,
        ISystemPromptTheory.CreateNew createSystemPrompt,
        IModelSwitchTheory.CreateNew createModelSwitch,
        IToolUpdateTheory.CreateNew createToolUpdate,
        IAgentRepository agents,
        IRepository<ITestSuite> suites,
        IRepository<IModelEndpoint> endpoints,
        TheoryDtoMapper mapper)
    {
        this.repository = repository;
        this.validationService = validationService;
        this.createSystemPrompt = createSystemPrompt;
        this.createModelSwitch = createModelSwitch;
        this.createToolUpdate = createToolUpdate;
        this.agents = agents;
        this.suites = suites;
        this.endpoints = endpoints;
        this.mapper = mapper;
    }

    [HttpGet]
    public async Task<IReadOnlyList<TheoryDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] TheoryStatus? status = null,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<IOptimizationTheory> theories;
        if (agentId.HasValue)
            theories = await repository.GetByAgentAsync(agentId.Value, cancellationToken);
        else if (projectId.HasValue)
            theories = await repository.GetByProjectAsync(projectId.Value, cancellationToken);
        else
            theories = await repository.GetAllAsync(cancellationToken);

        if (status.HasValue)
            theories = theories.Where(t => t.Status == status.Value).ToList();

        return theories.Select(mapper.ToDto).ToList();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TheoryDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var theory = await repository.FindAsync(id, cancellationToken);
        return theory is null ? NotFound() : Ok(mapper.ToDto(theory));
    }

    /// <summary>
    /// Submits a new optimization theory from any producer. The theory is deduplicated and
    /// rate-limited, then validated by an A/B run in the background.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<TheoryDto>> Submit(
        [FromBody] SubmitTheoryRequest request,
        CancellationToken cancellationToken)
    {
        var agent = await agents.FindAsync(request.AgentId, cancellationToken);
        if (agent is null)
            return NotFound($"Agent {request.AgentId} does not exist.");

        var suite = await suites.FindAsync(request.SuiteId, cancellationToken);
        if (suite is null)
            return NotFound($"Suite {request.SuiteId} does not exist.");

        IOptimizationTheory theory;
        switch (request.Details)
        {
            case SystemPromptDetailsDto systemPrompt:
                theory = createSystemPrompt(
                    agent, suite, request.Source, request.Priority, request.Rationale,
                    systemPrompt.ProposedSystemMessage, evidenceTestRunIds: []);
                break;

            case ModelSwitchSeedDetailsDto modelSwitch:
            {
                var proposedEndpoint = await endpoints.FindAsync(modelSwitch.ProposedEndpointId, cancellationToken);
                if (proposedEndpoint is null)
                    return BadRequest($"Proposed endpoint {modelSwitch.ProposedEndpointId} does not exist.");

                theory = createModelSwitch(
                    agent, suite, request.Source, request.Priority, request.Rationale,
                    proposedEndpoint, evidenceTestRunIds: []);
                break;
            }

            case ToolUpdateSeedDetailsDto toolUpdate:
            {
                var proposedTools = toolUpdate.ProposedTools
                    .Select(t => new ToolSpecification(
                        t.Name,
                        t.Description,
                        string.IsNullOrWhiteSpace(t.ParametersJson)
                            ? ToolArguments.None
                            : ToolArguments.FromJsonSchema(t.ParametersJson)))
                    .ToList();

                theory = createToolUpdate(
                    agent, suite, request.Source, request.Priority, request.Rationale,
                    proposedTools, evidenceTestRunIds: []);
                break;
            }

            default:
                return BadRequest("Unsupported theory details kind.");
        }

        var result = await validationService.SubmitAsync(theory, cancellationToken);
        return (result.Outcome, result.Theory) switch
        {
            (TheorySubmissionOutcome.Accepted, { } accepted) => Accepted(mapper.ToDto(accepted)),
            (TheorySubmissionOutcome.Duplicate, _) => Conflict("An identical theory or proposal already exists."),
            (TheorySubmissionOutcome.QuotaExceeded, _) => StatusCode(
                StatusCodes.Status429TooManyRequests,
                "The project has too many theories awaiting validation. Try again later."),
            _ => StatusCode(StatusCodes.Status500InternalServerError),
        };
    }
}
