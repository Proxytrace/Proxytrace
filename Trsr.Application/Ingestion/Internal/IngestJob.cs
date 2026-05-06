using System.Net;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Application.Ingestion.Internal;

internal sealed record IngestJob(
    IModelProvider Provider,
    IProject Project,
    string RequestBody,
    string? ResponseBody,
    TimeSpan Duration,
    HttpStatusCode HttpStatus,
    string? SessionId = null);
