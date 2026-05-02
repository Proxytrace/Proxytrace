using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Logging;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent.Internal;

internal record Agent : DomainEntity, IAgent
{
    public string Name { get; }
    public IProject Project { get; }
    public SystemMessage SystemMessage { get; }
    public IReadOnlyList<ToolSpecification> Tools { get; }

    public Agent(
        string name,
        SystemMessage systemMessage,
        IReadOnlyList<ToolSpecification> tools,
        IProject project)
    {
        Name = name;
        SystemMessage = systemMessage;
        Project = project;
        Tools = tools;
    }

    public Agent(
        string name,
        IProject project,
        SystemMessage systemMessage,
        IReadOnlyList<ToolSpecification> tools,
        IDomainEntityData existing,
        ILogger<Agent> logger) : base(existing)
    {
        Name = name;
        Project = project;
        SystemMessage = systemMessage;
        Tools = tools;
    }

    public async Task<AssistantMessage> CompleteAsync(
        Conversation conversation, 
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        conversation = Conversation.ReplaceSystemMessage(conversation, SystemMessage);

        AssistantMessage response = await endpoint.CreateClient().CompleteAsync(
            conversation,
            ModelOptions.FromAgent(this, endpoint.Model),
            cancellationToken);

        return response;
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
            yield return Validation.NotNullOrWhiteSpace(Name, nameof(Name));
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