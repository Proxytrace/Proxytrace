using System.ComponentModel.DataAnnotations;

namespace Proxytrace.Domain.Inference.Internal;

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
    {
        // Fold Stop's elements (Equals uses SequenceEqual on it); hashing the list reference would
        // give equal-content instances different hashes and break the Equals/GetHashCode contract.
        var hash = new HashCode();
        hash.Add(Temperature);
        hash.Add(TopP);
        hash.Add(ReasoningEffort);
        hash.Add(FrequencyPenalty);
        hash.Add(PresencePenalty);
        hash.Add(MaxTokens);
        hash.Add(Seed);
        hash.Add(N);
        foreach (string stop in Stop ?? [])
        {
            hash.Add(stop);
        }
        return hash.ToHashCode();
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield break;
    }
}
