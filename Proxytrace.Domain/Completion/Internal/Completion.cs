using System.ComponentModel.DataAnnotations;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Domain.Completion.Internal;

internal sealed record Completion : ICompletion
{
    public AssistantMessage Response { get; }
    public TokenUsage? Usage { get; }
    public TimeSpan Latency { get; }

    public Completion(AssistantMessage response,  TokenUsage? usage, TimeSpan latency)
    {
        Response = response;
        Usage = usage;
        Latency = latency;
    }
    
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var validationResult in Response.Validate(validationContext))
        {
            yield return validationResult;
        }
        
        foreach (var validationResult in Usage?.Validate(validationContext) ?? [])
        {
            yield return validationResult;
        }

        yield return Validation.Positive(Latency);
    }
}