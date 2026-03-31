using System.ComponentModel.DataAnnotations;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;

namespace Trsr.Domain.Evaluator.Internal;

internal record ExactMatchEvaluator : DomainEntity, IEvaluator
{
    public EvaluatorKind Kind => EvaluatorKind.ExactMatch;

    public ExactMatchEvaluator() { }

    public ExactMatchEvaluator(EvaluatorKind kind, IDomainEntityData existing) : base(existing) { }

    public bool Evaluate(AssistantMessage expected, AssistantMessage actual)
        => expected.Equals(actual);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        => base.Validate(validationContext);
}
