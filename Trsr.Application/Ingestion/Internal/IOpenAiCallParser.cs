using System.Diagnostics.CodeAnalysis;
using System.Net;
using Trsr.Domain.ModelProvider;

namespace Trsr.Application.Ingestion.Internal;

internal interface IOpenAiCallParser
{
    bool TryParse(
        IModelProvider provider,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        [NotNullWhen(true)] out OpenAiCallParseResult? result);
}
