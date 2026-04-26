using System.Diagnostics.CodeAnalysis;
using System.Net;

namespace Trsr.Api.Services.Internal;

internal interface IOpenAiCallParser
{
    bool TryParse(
        string provider,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        [NotNullWhen(true)] out OpenAiCallParseResult? result);
}
