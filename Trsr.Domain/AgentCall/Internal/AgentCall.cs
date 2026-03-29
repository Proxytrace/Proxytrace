using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.AgentCall.Internal;

internal record AgentCall : DomainEntity, IAgentCall
{
    public string Model { get; }
    public string Provider { get; }
    public string Request { get; }
    public string? Response { get; }
    public int? InputTokens { get; }
    public int? OutputTokens { get; }
    public long DurationMs { get; }
    public int HttpStatus { get; }
    public string? FinishReason { get; }
    public string? ErrorMessage { get; }

    public AgentCall(
        string model,
        string provider,
        string request,
        string? response,
        int? inputTokens,
        int? outputTokens,
        long durationMs,
        int httpStatus,
        string? finishReason,
        string? errorMessage)
    {
        Model = model;
        Provider = provider;
        Request = request;
        Response = response;
        InputTokens = inputTokens;
        OutputTokens = outputTokens;
        DurationMs = durationMs;
        HttpStatus = httpStatus;
        FinishReason = finishReason;
        ErrorMessage = errorMessage;
    }

    public AgentCall(IAgentCallData existing) : base(existing)
    {
        Model = existing.Model;
        Provider = existing.Provider;
        Request = existing.Request;
        Response = existing.Response;
        InputTokens = existing.InputTokens;
        OutputTokens = existing.OutputTokens;
        DurationMs = existing.DurationMs;
        HttpStatus = existing.HttpStatus;
        FinishReason = existing.FinishReason;
        ErrorMessage = existing.ErrorMessage;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        yield return Validation.NotNullOrWhiteSpace(Model, nameof(Model));
        yield return Validation.NotNullOrWhiteSpace(Provider, nameof(Provider));
        yield return Validation.NotNullOrWhiteSpace(Request, nameof(Request));
    }
}
