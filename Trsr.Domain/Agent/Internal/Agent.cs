using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent.Internal;

internal record Agent : DomainEntity, IAgent
{
    public Guid Project { get; set; }
    public SystemMessage SystemMessage { get; set; }
    public IReadOnlyCollection<ToolSpecification> Tools { get; }

    public Agent(SystemMessage systemMessage, IReadOnlyCollection<ToolSpecification> tools, Guid project)
    {
        SystemMessage = systemMessage;
        Project = project;
        Tools = tools;
    }

    public Agent(IAgentData existing) : base(existing)
    {
        SystemMessage = existing.SystemMessage;
        Project = existing.Project;
        Tools = existing.Tools;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (Project == Guid.Empty)
        {
            yield return Validation.NotDefault(Project, nameof(Project));
        }

        if (SystemMessage is null)
        {
            yield return Validation.NotNull(SystemMessage, nameof(SystemMessage));
        }
    }
}
