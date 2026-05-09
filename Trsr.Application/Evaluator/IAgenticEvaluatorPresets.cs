namespace Trsr.Application.Evaluator;

public interface IAgenticEvaluatorPresets
{
    IReadOnlyList<AgenticEvaluatorPreset> GetAll();
}

public sealed record AgenticEvaluatorPreset(string Key, string Name, string SystemPrompt);
