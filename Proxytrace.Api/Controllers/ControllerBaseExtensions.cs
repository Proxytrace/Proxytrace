using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Proxytrace.Api.Controllers;

internal static class ControllerBaseExtensions
{
    /// <summary>
    /// Runs a hard-delete and maps the result to 204/404, translating an FK-<c>Restrict</c>
    /// <see cref="DbUpdateException"/> into a 409 carrying <paramref name="conflictMessage"/> instead
    /// of letting the constraint surface as an opaque 500. Mirrors the pattern in
    /// <see cref="ProjectsController"/>. (Soft-deleted/archivable entities don't need this — archive
    /// never touches the FK.)
    /// </summary>
    public static async Task<IActionResult> DeleteOrConflictAsync(
        this ControllerBase controller,
        Func<Task<bool>> remove,
        string conflictMessage)
    {
        try
        {
            return await remove() ? controller.NoContent() : controller.NotFound();
        }
        catch (DbUpdateException)
        {
            return controller.Conflict(new { error = conflictMessage });
        }
    }
}
