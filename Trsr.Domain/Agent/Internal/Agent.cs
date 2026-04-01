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
    public SystemMessage SystemMessage { get; }
    public IReadOnlyCollection<ToolSpecification> Tools { get; }

    public Agent(SystemMessage systemMessage, IReadOnlyCollection<ToolSpecification> tools, IProject project)
    {
        SystemMessage = systemMessage;
        Project = project;
        Tools = tools;
    }

    public Agent(IProject project, SystemMessage systemMessage, IReadOnlyCollection<ToolSpecification> tools, IDomainEntityData existing) : base(existing)
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
        
        if (SystemMessage is null)
        {
            yield return Validation.NotNull(SystemMessage, nameof(SystemMessage));
        }
        else
        {
            foreach (var result in SystemMessage.Validate(validationContext))
            {
                yield return result;
            }
        }

        if (Project is null)
        {
            yield return Validation.NotNull(Project, nameof(Project));
        }
        else
        {
            foreach (var result in Project.Validate(validationContext))
            {
                yield return result;
            }
        }
    }
}
