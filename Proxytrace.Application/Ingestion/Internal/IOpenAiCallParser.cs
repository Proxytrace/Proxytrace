using System.Net;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Application.Ingestion.Internal;

internal sealed record ParseResult(
    IModelEndpoint Endpoint,
    Conversation Request,
    ICompletion? Response,
    HttpStatusCode HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    SystemMessage SystemMessage,
    IReadOnlyList<ToolSpecification> Tools,
    IModelParameters ModelParameters);


internal interface IOpenAiCallParser
{
    Task<ParseResult?> TryParse(IModelProvider provider,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken = default);
}
