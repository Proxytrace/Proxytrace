using System.Net;
using Trsr.Domain.Message;
using Trsr.Domain.Tools;
using Trsr.Domain.Usage;

namespace Trsr.Api.Services.Internal;

internal sealed record OpenAiCallParseResult(
    string Model,
    string Provider,
    Conversation Request,
    AssistantMessage Response,
    TokenUsage Usage,
    TimeSpan Duration,
    HttpStatusCode HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    SystemMessage SystemMessage,
    IReadOnlyCollection<ToolSpecification> Tools);
