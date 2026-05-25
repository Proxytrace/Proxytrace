namespace Proxytrace.Storage.Internal.Entities.Inference;

/// <summary>
/// Storage value object for serializing <see cref="Proxytrace.Domain.Inference.IModelParameters"/> as JSON.
/// </summary>
internal record ModelParametersData(
    double? Temperature,
    double? TopP,
    string? ReasoningEffort,
    double? FrequencyPenalty,
    double? PresencePenalty,
    int? MaxTokens,
    long? Seed,
    IReadOnlyList<string>? Stop,
    int? N)
{
    public static ModelParametersData Empty { get; } = new(null, null, null, null, null, null, null, null, null);
}
