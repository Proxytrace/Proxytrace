using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Domain;
using Trsr.Domain.TestCase;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class TestCasesControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Get_Unknown_ReturnsNotFound()
    {
        var services = GetServices();
        var controller = new TestCasesController(services.GetRequiredService<IRepository<ITestCase>>());

        var result = await controller.Get(Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Get_Existing_ReturnsDtoWithMessages()
    {
        var services = GetServices();
        var controller = new TestCasesController(services.GetRequiredService<IRepository<ITestCase>>());
        var testCase = await services.GetRequiredService<IDomainEntityGenerator<ITestCase>>().CreateAsync(CancellationToken);

        var result = await controller.Get(testCase.Id, CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Id.Should().Be(testCase.Id);
        result.Value.Input.Should().HaveCount(testCase.Input.Messages.Count);
        result.Value.ExpectedOutput.Role.Should().Be("assistant");
    }
}
