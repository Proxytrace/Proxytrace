using System.Diagnostics.CodeAnalysis;
using System.Net;
using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Tools;
using Trsr.Domain.Usage;

namespace Trsr.Application.Ingestion.Internal;

internal sealed record ParseResult(
    IModelEndpoint Endpoint,
    Conversation Request,
    ICompletion? Response,
    HttpStatusCode HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    SystemMessage SystemMessage,
    IReadOnlyList<ToolSpecification> Tools);


internal interface IOpenAiCallParser
{
    Task<ParseResult?> TryParse(IModelProvider provider,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken = default);
}
