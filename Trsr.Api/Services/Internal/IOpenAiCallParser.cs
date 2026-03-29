using System.Net;

namespace Trsr.Api.Services.Internal;

internal interface IOpenAiCallParser
{
    OpenAiCallParseResult? Parse(
        string provider,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus);
}
