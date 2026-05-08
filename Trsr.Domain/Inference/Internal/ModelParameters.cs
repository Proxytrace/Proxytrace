using System.ComponentModel.DataAnnotations;

namespace Trsr.Domain.Inference.Internal;

internal sealed record ModelParameters : IModelParameters
{
    public double? Temperature { get; }
    public double? TopP { get; }
    public string? ReasoningEffort { get; }
    public double? FrequencyPenalty { get; }
    public double? PresencePenalty { get; }
    public int? MaxTokens { get; }
    public long? Seed { get; }
    public IReadOnlyList<string>? Stop { get; }
    public int? N { get; }

    public static IModelParameters Empty { get; } = new ModelParameters();

    public ModelParameters(
        double? temperature = null,
        double? topP = null,
        string? reasoningEffort = null,
        double? frequencyPenalty = null,
        double? presencePenalty = null,
        int? maxTokens = null,
        long? seed = null,
        IReadOnlyList<string>? stop = null,
        int? n = null)
    {
        Temperature = temperature;
        TopP = topP;
        ReasoningEffort = reasoningEffort;
        FrequencyPenalty = frequencyPenalty;
        PresencePenalty = presencePenalty;
        MaxTokens = maxTokens;
        Seed = seed;
        Stop = stop;
        N = n;
    }

    public bool Equals(ModelParameters? other)
    {
        if (other is null)
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        return Temperature == other.Temperature
            && TopP == other.TopP
            && ReasoningEffort == other.ReasoningEffort
            && FrequencyPenalty == other.FrequencyPenalty
            && PresencePenalty == other.PresencePenalty
            && MaxTokens == other.MaxTokens
            && Seed == other.Seed
            && N == other.N
            && (Stop ?? []).SequenceEqual(other.Stop ?? []);
    }

    public override int GetHashCode() 
        => HashCode.Combine(
            Temperature, 
            TopP, 
            ReasoningEffort,
            FrequencyPenalty,
            PresencePenalty,
            MaxTokens,
            HashCode.Combine(Seed, N, Stop));

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield break;
    }
}
