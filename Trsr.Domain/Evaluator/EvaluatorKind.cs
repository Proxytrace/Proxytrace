namespace Trsr.Domain.Evaluator;

public enum EvaluatorKind
{
    Custom = 0,
    ExactMatch = 1,
    NumericMatch = 2,
    Helpfulness = 3,
    Politeness = 4,
    JsonSchemaMatch = 5,
    Safety = 6,
    ToolUsage = 7,
}
