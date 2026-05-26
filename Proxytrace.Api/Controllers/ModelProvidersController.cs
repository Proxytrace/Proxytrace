using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto;
using Proxytrace.Api.Dto.ApiKeys;
using Proxytrace.Api.Dto.ModelProviders;
using Proxytrace.Api.Dto.Projects;
using Proxytrace.Domain;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
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
        IModelEndpoint.CreateExisting updateEndpoint)
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
    }

    [HttpGet]
    public async Task<PagedResult<ModelProviderDto>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var all = await providerRepository.GetAllAsync(cancellationToken);
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).Select(ToDto).ToArray();
        return new PagedResult<ModelProviderDto>(items, all.Count, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ModelProviderDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var provider = await providerRepository.FindAsync(id, cancellationToken);
        if (provider is null)
            return NotFound();
        return ToDto(provider);
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
                ToDto(p),
                endpointsByProvider[p.Id].Select(ToEndpointDto).ToArray(),
                keysByProvider[p.Id].Select(ToKeyDto).ToArray()))
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
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
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
        return ToDto(saved);
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
        return all.Select(ToEndpointDto).ToArray();
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
        return all.Where(e => e.Provider.Id == providerId).Select(ToEndpointDto).ToArray();
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
            return Conflict($"A model endpoint for '{request.ModelName}' already exists for this provider.");

        var allModels = await modelRepository.GetAllAsync(cancellationToken);
        IModel model = allModels.FirstOrDefault(m => m.Name == request.ModelName)
            ?? await modelRepository.GetOrCreateAsync(request.ModelName, cancellationToken);

        var endpoint = createEndpoint(model, provider, request.InputTokenCost, request.OutputTokenCost);
        var saved = await endpointRepository.AddAsync(endpoint, cancellationToken);
        return CreatedAtAction(nameof(GetModels), new { providerId }, ToEndpointDto(saved));
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
        return ToEndpointDto(saved);
    }

    // ── API Keys ──────────────────────────────────────────────────────────────

    [HttpGet("{providerId:guid}/keys")]
    public async Task<IReadOnlyList<ApiKeyDto>> GetKeys(Guid providerId, CancellationToken cancellationToken)
    {
        var all = await apiKeyRepository.GetAllAsync(cancellationToken);
        return all.Where(k => k.Provider.Id == providerId).Select(ToKeyDto).ToArray();
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
        var key = createApiKey(request.Name, keyValue, project, provider);
        var saved = await apiKeyRepository.AddAsync(key, cancellationToken);
        return CreatedAtAction(nameof(GetKeys), new { providerId }, ToKeyDto(saved));
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

    private static ModelProviderDto ToDto(IModelProvider p) =>
        new(p.Id, p.Name, p.Endpoint.ToString(), p.ApiKey, p.Kind, p.CreatedAt, p.UpdatedAt);

    private static ApiKeyDto ToKeyDto(IApiKey k) =>
        new(k.Id, k.Name, k.ApiKey, k.Project.Id, k.Project.Name, k.Provider.Id, k.Provider.Name, k.CreatedAt);

    private static ModelEndpointDto ToEndpointDto(IModelEndpoint e) =>
        new(e.Id, e.Model.Name, e.Provider.Id, e.Provider.Name, e.InputTokenCost, e.OutputTokenCost, e.CreatedAt, e.UpdatedAt);
}
