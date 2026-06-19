using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.Notifications;
using Proxytrace.Api.Json;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationRepository repository;
    private readonly INotificationBroadcaster broadcaster;
    private readonly NotificationDtoMapper mapper;

    public NotificationsController(
        INotificationRepository repository,
        INotificationBroadcaster broadcaster,
        NotificationDtoMapper mapper)
    {
        this.repository = repository;
        this.broadcaster = broadcaster;
        this.mapper = mapper;
    }

    [HttpGet]
    public async Task<IReadOnlyList<NotificationDto>> GetAll(
        [FromQuery] Guid? projectId = null,
        [FromQuery] bool includeRead = true,
        CancellationToken cancellationToken = default)
    {
        var notifications = await repository.GetForScopeAsync(projectId, includeRead, cancellationToken);
        return notifications.Select(mapper.ToDto).ToList();
    }

    [HttpPatch("{id:guid}/read")]
    public async Task<ActionResult<NotificationDto>> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        var existing = await repository.FindAsync(id, cancellationToken);
        if (existing is null)
            return NotFound();

        if (existing.Status == NotificationStatus.Dismissed)
            return Conflict(new { error = "Cannot mark a dismissed notification read." });

        var updated = await existing.MarkRead(cancellationToken);
        if (updated.Status != existing.Status)
            broadcaster.Publish(NotificationStatusChangedEvent.Create(updated));
        return Ok(mapper.ToDto(updated));
    }

    [HttpPatch("{id:guid}/dismiss")]
    public async Task<ActionResult<NotificationDto>> Dismiss(Guid id, CancellationToken cancellationToken)
    {
        var existing = await repository.FindAsync(id, cancellationToken);
        if (existing is null)
            return NotFound();

        var updated = await existing.Dismiss(cancellationToken);
        if (updated.Status != existing.Status)
            broadcaster.Publish(NotificationStatusChangedEvent.Create(updated));
        return Ok(mapper.ToDto(updated));
    }

    [HttpGet("stream")]
    public async Task Stream([FromQuery] Guid? projectId = null, CancellationToken cancellationToken = default)
    {
        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = broadcaster.Subscribe(cancellationToken);
        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            // The broadcaster is global; scope each connection to its project so another project's
            // notification content never crosses the wire. Global (null-project) events always pass.
            if (evt.ProjectId is { } eventProject && eventProject != projectId)
                continue;

            string eventName = evt switch
            {
                NotificationCreatedEvent => "notification-created",
                NotificationStatusChangedEvent => "notification-status-changed",
                _ => "unknown",
            };
            var data = SseEventSerializer.Serialize(evt, evt.GetType());
            await Response.WriteAsync($"event: {eventName}\ndata: {data}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }
}
