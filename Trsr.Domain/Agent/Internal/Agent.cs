using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Logging;
using Trsr.Common.Validation;
using Trsr.Domain.Inference;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent.Internal;

internal record Agent : DomainEntity<IAgent>, IAgent
{
    private readonly IModelClient.Factory modelClientFactory;
    private readonly ILogger<IAgent> logger;

    public string Name { get; }
    public IModelEndpoint Endpoint { get; private init; }
    public IProject Project { get; }
    public IPromptTemplate SystemPrompt { get; }
    public IReadOnlyList<ToolSpecification> Tools { get; }
    public IModelParameters ModelParameters { get; private init; }
    public bool IsSystemAgent { get; }

    public Agent(
        string name,
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        IProject project,
        IModelParameters modelParameters,
        bool isSystemAgent,
        IRepository<IAgent> repository,
        IModelClient.Factory modelClientFactory,
        ILogger<IAgent> logger) : base(repository)
    {
        this.modelClientFactory = modelClientFactory;
        this.logger = logger;

        Name = name;
        SystemPrompt = systemPrompt;
        Project = project;
        Tools = tools;
        Endpoint = endpoint;
        ModelParameters = modelParameters;
        IsSystemAgent = isSystemAgent;
    }

    public Agent(
        string name,
        IProject project,
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        bool isSystemAgent,
        IModelParameters modelParameters,
        IDomainEntityData existing,
        IRepository<IAgent> repository,
        IModelClient.Factory modelClientFactory,
        ILogger<IAgent> logger) : base(existing, repository)
    {
        this.modelClientFactory = modelClientFactory;
        this.logger = logger;

        Name = name;
        Project = project;
        SystemPrompt = systemPrompt;
        Tools = tools;
        Endpoint = endpoint;
        ModelParameters = modelParameters;
        IsSystemAgent = isSystemAgent;
    }

    public IModelClient CreateClient(
        IModelEndpoint? customEndpoint = null,
        bool skipIngestion = false)
        => modelClientFactory(this, customEndpoint, skipIngestion: skipIngestion);

    public Task<IAgent> ChangeEndpoint(IModelEndpoint modelEndpoint,
        CancellationToken cancellationToken = default)
    {
        if (modelEndpoint.Id == Endpoint.Id)
        {
            logger.LogWarning(
                "Attempted to change agent endpoint to the same endpoint (AgentId: {AgentId}, EndpointId: {EndpointId})",
                Id, modelEndpoint.Id);
            return Task.FromResult<IAgent>(this);
        }

        return ApplyAsync(this with { Endpoint = modelEndpoint }, cancellationToken);
    }

    public Task<IAgent> ChangeModelParameters(
        IModelParameters modelParameters,
        CancellationToken cancellationToken = default) 
        => ModelParameters.Equals(modelParameters)
            ? Task.FromResult<IAgent>(this)
            : ApplyAsync(this with { ModelParameters = modelParameters }, cancellationToken);

    public SystemMessage CreateSystemMessage(IReadOnlyDictionary<string, string>? variables = null)
        => Message.Message.CreateSystemMessage(SystemPrompt, variables);

    /// <inheritdoc />
    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (string.IsNullOrWhiteSpace(Name))
        {
            foreach (var __r in Validation.NotNullOrWhiteSpace(Name).AsEnumerable()) yield return __r;
        }

        foreach (var result in Endpoint.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in SystemPrompt.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in Project.Validate(validationContext))
        {
            yield return result;
        }
    }
}
