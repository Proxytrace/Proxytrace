using System.Net;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Api.Services.Internal;

internal sealed record IngestJob(
    IModelProvider Provider,
    IProject Project,
    string RequestBody,
    string? ResponseBody,
    TimeSpan Duration,
    HttpStatusCode HttpStatus);
