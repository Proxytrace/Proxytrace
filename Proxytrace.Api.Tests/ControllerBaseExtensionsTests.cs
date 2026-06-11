using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Api.Controllers;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class ControllerBaseExtensionsTests
{
    // The in-memory provider doesn't enforce FK Restrict, so the 409 path can't be triggered through
    // real storage — exercise the translation directly via a minimal controller.
    private sealed class TestController : ControllerBase;

    [TestMethod]
    public async Task DeleteOrConflictAsync_WhenRemoved_ReturnsNoContent()
    {
        var result = await new TestController().DeleteOrConflictAsync(() => Task.FromResult(true), "nope");

        result.Should().BeOfType<NoContentResult>();
    }

    [TestMethod]
    public async Task DeleteOrConflictAsync_WhenNotRemoved_ReturnsNotFound()
    {
        var result = await new TestController().DeleteOrConflictAsync(() => Task.FromResult(false), "nope");

        result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task DeleteOrConflictAsync_WhenRestrictViolation_ReturnsConflictWithMessage()
    {
        var result = await new TestController().DeleteOrConflictAsync(
            () => throw new DbUpdateException("FK Restrict"),
            "still referenced");

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.Value.Should().BeEquivalentTo(new { error = "still referenced" });
    }
}
