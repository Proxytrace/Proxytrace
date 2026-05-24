using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Api.Dto.Evaluators;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class EvaluatorsControllerTests : BaseTest<Module>
{
    [TestMethod]
    public void GetAgenticPresets_ReturnsNonEmpty()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = controller.GetAgenticPresets();

        result.Should().NotBeEmpty();
    }

    [TestMethod]
    public async Task GetAll_NoEvaluators_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Should().BeEmpty();
    }

    [TestMethod]
    public async Task Get_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Get(Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Create_ExactMatch_PersistsAndReturnsDto()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

        var result = await controller.Create(
            new CreateEvaluatorRequest(EvaluatorKind.ExactMatch, project.Id, null, null, null, null, null),
            CancellationToken);

        var created = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException());
        var dto = (EvaluatorDetailDto?)created.Value;
        dto.Should().NotBeNull();
        dto.Kind.Should().Be(EvaluatorKind.ExactMatch);
    }

    [TestMethod]
    public async Task Create_UnknownProject_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Create(
            new CreateEvaluatorRequest(EvaluatorKind.ExactMatch, Guid.NewGuid(), null, null, null, null, null),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Create_Agentic_MissingSystemMessage_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

        var result = await controller.Create(
            new CreateEvaluatorRequest(EvaluatorKind.Agentic, project.Id, "MyJudge", null, null, null, null),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Create_NumericMatch_MissingPattern_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

        var result = await controller.Create(
            new CreateEvaluatorRequest(EvaluatorKind.NumericMatch, project.Id, null, null, null, null, 0.1m),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Create_NumericMatch_MissingTolerance_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

        var result = await controller.Create(
            new CreateEvaluatorRequest(EvaluatorKind.NumericMatch, project.Id, null, null, null, @"\d+", null),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Create_NumericMatch_Valid_Persists()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

        var result = await controller.Create(
            new CreateEvaluatorRequest(EvaluatorKind.NumericMatch, project.Id, null, null, null, @"(\d+)", 0.1m),
            CancellationToken);

        var created = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException());
        var dto = (EvaluatorDetailDto?)created.Value;
        dto.Should().NotBeNull();
        dto.Kind.Should().Be(EvaluatorKind.NumericMatch);
        dto.Tolerance.Should().Be(0.1m);
    }

    [TestMethod]
    public async Task Create_JsonSchemaMatch_MissingSchema_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

        var result = await controller.Create(
            new CreateEvaluatorRequest(EvaluatorKind.JsonSchemaMatch, project.Id, null, null, null, null, null),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Create_JsonSchemaMatch_Valid_Persists()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

        var result = await controller.Create(
            new CreateEvaluatorRequest(
                EvaluatorKind.JsonSchemaMatch, project.Id, null, null,
                """{"type":"object"}""", null, null),
            CancellationToken);

        var created = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException());
        var dto = (EvaluatorDetailDto?)created.Value;
        dto.Should().NotBeNull();
        dto.Kind.Should().Be(EvaluatorKind.JsonSchemaMatch);
    }

    [TestMethod]
    public async Task Delete_Existing_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var eval = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);

        var result = await controller.Delete(eval.Id, CancellationToken);

        result.Should().BeOfType<NoContentResult>();
    }

    [TestMethod]
    public async Task Delete_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Delete(Guid.NewGuid(), CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
    }

    private static EvaluatorsController ResolveController(IServiceProvider services) =>
        services.GetRequiredService<EvaluatorsController>();
}
