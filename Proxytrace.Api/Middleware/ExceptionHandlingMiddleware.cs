using System.Text.Json;
using Proxytrace.Api.Middleware.Exceptions;

namespace Proxytrace.Api.Middleware;

internal sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate next;
    private readonly ILogger<ExceptionHandlingMiddleware> logger;
    private readonly IEnumerable<IExceptionMapper> mappers;
    private readonly bool isDevelopment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IEnumerable<IExceptionMapper> mappers,
        IWebHostEnvironment env)
    {
        this.next = next;
        this.logger = logger;
        this.mappers = mappers;
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
            // NotImplementedException marks an intentional stub — surface it as 501
            // without the alarming error-level log.
            if (ex is NotImplementedException)
                logger.LogInformation("Not-implemented endpoint called: {Path}", context.Request.Path);
            else
                logger.LogError(ex, "Unhandled exception");

            context.Response.ContentType = "application/json";

            var mapping = Resolve(ex);
            context.Response.StatusCode = mapping.StatusCode;

            var error = new Dictionary<string, object?>
            {
                ["message"] = mapping.Message ?? ex.Message,
                ["type"] = mapping.TypeName,
                ["stacktrace"] = isDevelopment ? ex.ToString() : null,
            };

            if (mapping.AdditionalFields is not null)
            {
                foreach (var (key, value) in mapping.AdditionalFields)
                    error[key] = value;
            }

            var response = JsonSerializer.Serialize(
                new Dictionary<string, object?> { ["error"] = error },
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

            await context.Response.WriteAsync(response);
        }
    }

    private ExceptionMapping Resolve(Exception exception)
    {
        foreach (var mapper in mappers)
        {
            if (mapper.CanMap(exception))
                return mapper.Map(exception);
        }

        // Unmapped exceptions are internal faults — outside development their message must not
        // reach the client (it may carry SQL, schema names, paths). Full detail is preserved in
        // the log capture (application error log) above.
        return new ExceptionMapping
        {
            StatusCode = StatusCodes.Status500InternalServerError,
            TypeName = exception.GetType().Name,
            Message = isDevelopment ? null : "An unexpected error occurred.",
        };
    }
}
