using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Logging;
using Trsr.Common.Validation;
using Trsr.Domain.Completion;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent.Internal;

internal record Agent : DomainEntity<IAgent>, IAgent
{
    private readonly ILogger<IAgent> logger;
    
    public string Name { get; }
    public IModelEndpoint Endpoint { get; }
    public IProject Project { get; }
    public SystemMessage SystemMessage { get; }
    public IReadOnlyList<ToolSpecification> Tools { get; }

    public Agent(
        string name,
        SystemMessage systemMessage,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        IProject project,
        IRepository<IAgent> repository,
        ILogger<IAgent> logger) : base(repository)
    {
        this.logger = logger;
        Name = name;
        SystemMessage = systemMessage;
        Project = project;
        Tools = tools;
        Endpoint = endpoint;
    }

    public Agent(
        string name,
        IProject project,
        SystemMessage systemMessage,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        IDomainEntityData existing,
        IRepository<IAgent> repository,
        ILogger<IAgent> logger) : base(existing, repository)
    {
        this.logger = logger;
        Name = name;
        Project = project;
        SystemMessage = systemMessage;
        Tools = tools;
        Endpoint = endpoint;
    }

    public Task<ICompletion> CompleteAsync(
        Conversation conversation,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        conversation = Conversation.ReplaceSystemMessage(conversation, SystemMessage);
        return endpoint.CreateClient().CompleteAsync(
            conversation,
            ModelOptions.FromAgent(this, endpoint.Model),
            cancellationToken);
    }

    public async Task<IAgent> ChangeEndpoint(IModelEndpoint modelEndpoint, CancellationToken cancellationToken = default)
    {
        if (modelEndpoint.Id == Endpoint.Id)
        {
            logger.LogWarning("Attempted to change agent endpoint to the same endpoint (AgentId: {AgentId}, EndpointId: {EndpointId})", Id, modelEndpoint.Id);
            return this;
        }
        
        var update = new Agent(
            Name,
            Project,
            SystemMessage,
            Tools,
            modelEndpoint,
            this,
            repository,
            logger);
        
        return await update.UpdateAsync(cancellationToken);
    }

    /// <inheritdoc />
    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (string.IsNullOrWhiteSpace(Name))
        {
            yield return Validation.NotNullOrWhiteSpace(Name);
        }
        
        foreach (var result in Endpoint.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in SystemMessage.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in Project.Validate(validationContext))
        {
            yield return result;
        }
    }
}