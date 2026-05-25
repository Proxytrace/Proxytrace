namespace Proxytrace.Domain.Inference;

/// <summary>
/// Sampling and decoding parameters extracted from an OpenAI-compatible chat completion request.
/// All fields are nullable; <see langword="null"/> means the client did not specify the value.
/// </summary>
public interface IModelParameters : IDomainObject
{
    public delegate IModelParameters Create(
        double? temperature = null,
        double? topP = null,
        string? reasoningEffort = null,
        double? frequencyPenalty = null,
        double? presencePenalty = null,
        int? maxTokens = null,
        long? seed = null,
        IReadOnlyList<string>? stop = null,
        int? n = null);

    double? Temperature { get; }
    double? TopP { get; }
    string? ReasoningEffort { get; }
    double? FrequencyPenalty { get; }
    double? PresencePenalty { get; }
    int? MaxTokens { get; }
    long? Seed { get; }
    IReadOnlyList<string>? Stop { get; }
    int? N { get; }
}
