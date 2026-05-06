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
    public string Name { get; }
    public IProject Project { get; }
    public SystemMessage SystemMessage { get; }
    public IReadOnlyList<ToolSpecification> Tools { get; }

    public Agent(
        string name,
        SystemMessage systemMessage,
        IReadOnlyList<ToolSpecification> tools,
        IProject project,
        IRepository<IAgent> repository) : base(repository)
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
        ILogger<Agent> logger,
        IRepository<IAgent> repository) : base(existing, repository)
    {
        Name = name;
        Project = project;
        SystemMessage = systemMessage;
        Tools = tools;
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