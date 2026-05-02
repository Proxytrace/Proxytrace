using System.Net;
using Trsr.Domain.Message;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Tools;
using Trsr.Domain.Usage;

namespace Trsr.Application.Ingestion.Internal;

internal sealed record OpenAiCallParseResult(
    string Model,
    IModelProvider Provider,
    Conversation Request,
    AssistantMessage Response,
    TokenUsage Usage,
    TimeSpan Duration,
    HttpStatusCode HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    SystemMessage SystemMessage,
    IReadOnlyList<ToolSpecification> Tools);
