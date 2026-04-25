using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent.Internal;

internal record Agent : DomainEntity, IAgent
{
    public IProject Project { get; }
    public SystemMessage SystemMessage { get; }
    public IReadOnlyCollection<ToolSpecification> Tools { get; }

    public Agent(
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IProject project)
    {
        SystemMessage = systemMessage;
        Project = project;
        Tools = tools;
    }

    public Agent(
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IProject project,
        IDomainEntityData existing) : base(existing)
    {
        Project = project;
        SystemMessage = systemMessage;
        Tools = tools;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
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