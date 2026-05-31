using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.ApiKeys;
using Proxytrace.Api.Dto.ModelProviders;
using Proxytrace.Api.Dto.Projects;
using Proxytrace.Domain;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Paging;
using Proxytrace.Domain.Project;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/providers")]
public class ModelProvidersController : ControllerBase
{
    private readonly IRepository<IModelProvider> providerRepository;
    private readonly IApiKeyRepository apiKeyRepository;
    private readonly IProjectRepository projectRepository;
    private readonly IModelEndpointRepository endpointRepository;
    private readonly IModelRepository modelRepository;
    private readonly IModelProvider.CreateNew createProvider;
    private readonly IModelProvider.CreateExisting updateProvider;
    private readonly IApiKey.CreateNew createApiKey;
    private readonly IModelEndpoint.CreateNew createEndpoint;
    private readonly IModelEndpoint.CreateExisting updateEndpoint;
    private readonly ModelProviderDtoMapper mapper;

    public ModelProvidersController(
        IRepository<IModelProvider> providerRepository,
        IApiKeyRepository apiKeyRepository,
        IProjectRepository projectRepository,
        IModelEndpointRepository endpointRepository,
        IModelProvider.CreateNew createProvider,
        IModelProvider.CreateExisting updateProvider,
        IApiKey.CreateNew createApiKey,
        IModelRepository modelRepository,
        IModelEndpoint.CreateNew createEndpoint,
        IModelEndpoint.CreateExisting updateEndpoint,
        ModelProviderDtoMapper mapper)
    {
        this.providerRepository = providerRepository;
        this.apiKeyRepository = apiKeyRepository;
        this.projectRepository = projectRepository;
        this.endpointRepository = endpointRepository;
        this.modelRepository = modelRepository;
        this.createProvider = createProvider;
        this.updateProvider = updateProvider;
        this.createApiKey = createApiKey;
        this.createEndpoint = createEndpoint;
        this.updateEndpoint = updateEndpoint;
        this.mapper = mapper;
    }

    [HttpGet]
    public async Task<PagedResult<ModelProviderDto>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var paged = await providerRepository.GetPagedAsync(page, pageSize, cancellationToken);
        return paged.Map(mapper.ToDto);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ModelProviderDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var provider = await providerRepository.FindAsync(id, cancellationToken);
        if (provider is null)
            return NotFound();
        return mapper.ToDto(provider);
    }

    [HttpGet("overview")]
    public async Task<ProvidersOverviewDto> GetOverview(CancellationToken cancellationToken = default)
    {
        Task<IReadOnlyList<IModelProvider>> providersTask = providerRepository.GetAllAsync(cancellationToken);
        Task<IReadOnlyList<IModelEndpoint>> endpointsTask = endpointRepository.GetAllAsync(cancellationToken);
        Task<IReadOnlyList<IApiKey>> keysTask = apiKeyRepository.GetAllAsync(cancellationToken);
        Task<IReadOnlyList<IProject>> projectsTask = projectRepository.GetAllAsync(cancellationToken);

        await Task.WhenAll(providersTask, endpointsTask, keysTask, projectsTask);

        ILookup<Guid, IModelEndpoint> endpointsByProvider = endpointsTask.Result.ToLookup(e => e.Provider.Id);
        ILookup<Guid, IApiKey> keysByProvider = keysTask.Result.ToLookup(k => k.Provider.Id);

        var providers = providersTask.Result
            .Select(p => new ProviderWithDetailsDto(
                mapper.ToDto(p),
                endpointsByProvider[p.Id].Select(mapper.ToEndpointDto).ToArray(),
                keysByProvider[p.Id].Select(mapper.ToKeyDto).ToArray()))
            .ToArray();

        return new ProvidersOverviewDto(
            providers,
            projectsTask.Result.Select(ProjectDtoMapper.ToDto).ToArray());
    }

    [HttpPost]
    public async Task<ActionResult<ModelProviderDto>> Create(
        [FromBody] CreateModelProviderRequest request,
        CancellationToken cancellationToken)
    {
        var provider = createProvider(request.Name, new Uri(request.Endpoint), request.UpstreamApiKey, request.Kind);
        var saved = await providerRepository.AddAsync(provider, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, mapper.ToDto(saved));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ModelProviderDto>> Update(
        Guid id,
        [FromBody] UpdateModelProviderRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await providerRepository.FindAsync(id, cancellationToken);
        if (existing is null)
            return NotFound();
        var updated = updateProvider(request.Name, new Uri(request.Endpoint), request.UpstreamApiKey, request.Kind, existing);
        var saved = await providerRepository.UpdateAsync(updated, cancellationToken);
        return mapper.ToDto(saved);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await providerRepository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    // ── Model Endpoints ───────────────────────────────────────────────────────

    [HttpGet("/api/model-endpoints")]
    public async Task<IReadOnlyList<ModelEndpointDto>> GetAllModelEndpoints(CancellationToken cancellationToken)
    {
        var all = await endpointRepository.GetAllAsync(cancellationToken);
        return all.Select(mapper.ToEndpointDto).ToArray();
    }

    // ── Models ────────────────────────────────────────────────────────────────

    [HttpGet("{providerId:guid}/available-models")]
    public async Task<ActionResult<IReadOnlyList<string>>> GetAvailableModels(Guid providerId, CancellationToken cancellationToken)
    {
        var provider = await providerRepository.GetAsync(providerId, cancellationToken);
        var client = provider.CreateClient();
        var models = await client.GetModelsAsync(cancellationToken);
        return models.Select(m => m.Name).OrderBy(n => n).ToArray();
    }

    [HttpGet("{providerId:guid}/models")]
    public async Task<ActionResult<IReadOnlyList<ModelEndpointDto>>> GetModels(Guid providerId, CancellationToken cancellationToken)
    {
        if (!await providerRepository.ContainsAsync(providerId, cancellationToken))
            return NotFound("Provider not found.");
        var all = await endpointRepository.GetAllAsync(cancellationToken);
        return all.Where(e => e.Provider.Id == providerId).Select(mapper.ToEndpointDto).ToArray();
    }

    [HttpPost("{providerId:guid}/models")]
    public async Task<ActionResult<ModelEndpointDto>> CreateModel(
        Guid providerId,
        [FromBody] CreateModelEndpointRequest request,
        CancellationToken cancellationToken)
    {
        var provider = await providerRepository.FindAsync(providerId, cancellationToken);
        if (provider is null)
            return NotFound("Provider not found.");

        var all = await endpointRepository.GetAllAsync(cancellationToken);
        if (all.Any(e => e.Provider.Id == providerId && e.Model.Name == request.ModelName))
            return Conflict(new { error = $"A model endpoint for '{request.ModelName}' already exists for this provider." });

        var allModels = await modelRepository.GetAllAsync(cancellationToken);
        IModel model = allModels.FirstOrDefault(m => m.Name == request.ModelName)
            ?? await modelRepository.GetOrCreateAsync(request.ModelName, cancellationToken);

        var endpoint = createEndpoint(model, provider, request.InputTokenCost, request.OutputTokenCost);
        var saved = await endpointRepository.AddAsync(endpoint, cancellationToken);
        return CreatedAtAction(nameof(GetModels), new { providerId }, mapper.ToEndpointDto(saved));
    }

    [HttpDelete("endpoints/{endpointId:guid}")]
    public async Task<IActionResult> DeleteModel(Guid endpointId, CancellationToken cancellationToken)
    {
        var removed = await endpointRepository.RemoveAsync(endpointId, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    [HttpPut("{providerId:guid}/models/{endpointId:guid}")]
    public async Task<ActionResult<ModelEndpointDto>> UpdateModelPricing(
        Guid providerId,
        Guid endpointId,
        [FromBody] UpdateModelEndpointPricingRequest request,
        CancellationToken cancellationToken)
    {
        if (!await providerRepository.ContainsAsync(providerId, cancellationToken))
            return NotFound("Provider not found.");

        var existing = await endpointRepository.FindAsync(endpointId, cancellationToken);
        if (existing is null)
            return NotFound("Model endpoint not found.");

        if (existing.Provider.Id != providerId)
            return NotFound("Model endpoint not found.");

        var updated = updateEndpoint(existing.Model, existing.Provider, request.InputTokenCost, request.OutputTokenCost, existing);
        var saved = await endpointRepository.UpdateAsync(updated, cancellationToken);
        return mapper.ToEndpointDto(saved);
    }

    // ── API Keys ──────────────────────────────────────────────────────────────

    [HttpGet("{providerId:guid}/keys")]
    public async Task<IReadOnlyList<ApiKeyDto>> GetKeys(Guid providerId, CancellationToken cancellationToken)
    {
        var all = await apiKeyRepository.GetAllAsync(cancellationToken);
        return all.Where(k => k.Provider.Id == providerId).Select(mapper.ToKeyDto).ToArray();
    }

    [HttpPost("{providerId:guid}/keys")]
    public async Task<ActionResult<ApiKeyDto>> CreateKey(
        Guid providerId,
        [FromBody] CreateApiKeyRequest request,
        CancellationToken cancellationToken)
    {
        var provider = await providerRepository.FindAsync(providerId, cancellationToken);
        if (provider is null)
            return NotFound("Provider not found.");
        var project = await projectRepository.FindAsync(request.ProjectId, cancellationToken);
        if (project is null)
            return BadRequest($"Project {request.ProjectId} not found.");

        var keyValue = $"proxytrace-{Guid.NewGuid():N}";
        var key = createApiKey(request.Name, keyValue, project, provider, expiresAt: null);
        var saved = await apiKeyRepository.AddAsync(key, cancellationToken);
        return CreatedAtAction(nameof(GetKeys), new { providerId }, mapper.ToKeyDto(saved));
    }

    [HttpDelete("{providerId:guid}/keys/{keyId:guid}")]
    public async Task<IActionResult> DeleteKey(Guid providerId, Guid keyId, CancellationToken cancellationToken)
    {
        var all = await apiKeyRepository.GetAllAsync(cancellationToken);
        if (!all.Any(k => k.Id == keyId && k.Provider.Id == providerId))
            return NotFound();
        var removed = await apiKeyRepository.RemoveAsync(keyId, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

}
