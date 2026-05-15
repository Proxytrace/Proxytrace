using System.Text.Json;
using Trsr.Domain.Exceptions;

namespace Trsr.Api.Middleware;

internal sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate next;
    private readonly ILogger<ExceptionHandlingMiddleware> logger;
    private readonly bool isDevelopment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IWebHostEnvironment env)
    {
        this.next = next;
        this.logger = logger;
        this.isDevelopment = env.IsDevelopment();
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Unhandled exception");

            context.Response.ContentType = "application/json";

            var statusCode = ex switch
            {
                EntityNotFoundException or EntitiesNotFoundException => StatusCodes.Status404NotFound,
                EntityAlreadyExistsException or OptimisticConcurrencyException => StatusCodes.Status409Conflict,
                _ => StatusCodes.Status500InternalServerError,
            };

            context.Response.StatusCode = statusCode;

            var error = new Dictionary<string, object?>
            {
                ["message"] = ex.Message,
                ["type"] = ex.GetType().Name,
                ["stacktrace"] = isDevelopment ? ex.ToString() : null,
            };

            var response = JsonSerializer.Serialize(
                new Dictionary<string, object?> { ["error"] = error },
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

            await context.Response.WriteAsync(response);
        }
    }
}
