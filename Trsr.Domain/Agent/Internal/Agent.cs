using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent.Internal;

internal record Agent : DomainEntity, IAgent
{
    public IProject Project { get; }
    public string Name { get; }
    public SystemMessage SystemMessage { get; }
    public IReadOnlyCollection<ToolSpecification> Tools { get; }

    public Agent(
        string name,
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IProject project)
    {
        Name = name;
        SystemMessage = systemMessage;
        Project = project;
        Tools = tools;
    }

    public Agent(
        string name,
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IProject project,
        IDomainEntityData existing) : base(existing)
    {
        Name = name;
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

        yield return Validation.NotNullOrWhiteSpace(Name, nameof(Name));

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