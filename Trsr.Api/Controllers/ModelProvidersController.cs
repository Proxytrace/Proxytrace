using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.ApiKeys;
using Trsr.Api.Dto.ModelProviders;
using Trsr.Domain;
using Trsr.Domain.ApiKey;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/providers")]
public class ModelProvidersController : ControllerBase
{
    private readonly IRepository<IModelProvider> providerRepository;
    private readonly IOrganizationRepository organizationRepository;
    private readonly IApiKeyRepository apiKeyRepository;
    private readonly IProjectRepository projectRepository;
    private readonly IModelProvider.CreateNew createProvider;
    private readonly IModelProvider.CreateExisting updateProvider;
    private readonly IApiKey.CreateNew createApiKey;

    public ModelProvidersController(
        IRepository<IModelProvider> providerRepository,
        IOrganizationRepository organizationRepository,
        IApiKeyRepository apiKeyRepository,
        IProjectRepository projectRepository,
        IModelProvider.CreateNew createProvider,
        IModelProvider.CreateExisting updateProvider,
        IApiKey.CreateNew createApiKey)
    {
        this.providerRepository = providerRepository;
        this.organizationRepository = organizationRepository;
        this.apiKeyRepository = apiKeyRepository;
        this.projectRepository = projectRepository;
        this.createProvider = createProvider;
        this.updateProvider = updateProvider;
        this.createApiKey = createApiKey;
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
        if (!await providerRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        return ToDto(await providerRepository.GetAsync(id, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<ModelProviderDto>> Create(
        [FromBody] CreateModelProviderRequest request,
        CancellationToken cancellationToken)
    {
        if (!await organizationRepository.ContainsAsync(request.OrganizationId, cancellationToken))
            return BadRequest($"Organization {request.OrganizationId} not found.");
        var org = await organizationRepository.GetAsync(request.OrganizationId, cancellationToken);
        var provider = createProvider(request.Name, new Uri(request.Endpoint), request.UpstreamApiKey, org);
        var saved = await providerRepository.AddAsync(provider, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ModelProviderDto>> Update(
        Guid id,
        [FromBody] UpdateModelProviderRequest request,
        CancellationToken cancellationToken)
    {
        if (!await providerRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var existing = await providerRepository.GetAsync(id, cancellationToken);
        var updated = updateProvider(request.Name, new Uri(request.Endpoint), request.UpstreamApiKey, existing.Organization, existing);
        var saved = await providerRepository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await providerRepository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
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
        if (!await providerRepository.ContainsAsync(providerId, cancellationToken))
            return NotFound("Provider not found.");
        if (!await projectRepository.ContainsAsync(request.ProjectId, cancellationToken))
            return BadRequest($"Project {request.ProjectId} not found.");

        var provider = await providerRepository.GetAsync(providerId, cancellationToken);
        var project = await projectRepository.GetAsync(request.ProjectId, cancellationToken);

        var keyValue = $"trsr-{Guid.NewGuid():N}";
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
        new(p.Id, p.Name, p.Endpoint.ToString(), p.ApiKey, p.Organization.Id, p.Organization.Name, p.CreatedAt, p.UpdatedAt);

    private static ApiKeyDto ToKeyDto(IApiKey k) =>
        new(k.Id, k.Name, k.ApiKey, k.Project.Id, k.Project.Name, k.Provider.Id, k.Provider.Name, k.CreatedAt);
}
