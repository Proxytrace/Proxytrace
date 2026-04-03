using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class EvaluatorValidationTests : BaseTest<Module>
{
    [TestMethod]
    public void CreateNew_CreatesEvaluator()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IEvaluator.CreateNew>();

        // Act
        var evaluator = factory();

        // Assert
        evaluator.Should().NotBeNull();
        evaluator.Id.Should().NotBe(Guid.Empty);
        evaluator.CreatedAt.Should().NotBe(default);
        evaluator.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public void CreateNew_HasExactMatchKind()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IEvaluator.CreateNew>();

        // Act
        var evaluator = factory();

        // Assert
        evaluator.Kind.Should().Be(EvaluatorKind.ExactMatch);
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesEvaluator()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IEvaluator.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>();
        var existing = await generator.CreateAsync(CancellationToken);

        // Act
        var evaluator = createExisting(existing.Kind, existing);

        // Assert
        evaluator.Should().NotBeNull();
        evaluator.Id.Should().Be(existing.Id);
        evaluator.Kind.Should().Be(existing.Kind);
        evaluator.CreatedAt.Should().Be(existing.CreatedAt);
        evaluator.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public void Evaluate_WithIdenticalMessages_ReturnsTrue()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IEvaluator.CreateNew>();
        var evaluator = factory();
        var message = new AssistantMessage([Content.FromText("Hello")], []);

        // Act
        var result = evaluator.Evaluate(message, message);

        // Assert
        result.Should().BeTrue();
    }

    [TestMethod]
    public void Evaluate_WithDifferentMessages_ReturnsFalse()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IEvaluator.CreateNew>();
        var evaluator = factory();
        var expected = new AssistantMessage([Content.FromText("Hello")], []);
        var actual = new AssistantMessage([Content.FromText("Goodbye")], []);

        // Act
        var result = evaluator.Evaluate(expected, actual);

        // Assert
        result.Should().BeFalse();
    }

    [TestMethod]
    public void Evaluate_WithEqualContentMessages_ReturnsTrue()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IEvaluator.CreateNew>();
        var evaluator = factory();
        var expected = new AssistantMessage([Content.FromText("Paris")], []);
        var actual = new AssistantMessage([Content.FromText("Paris")], []);

        // Act
        var result = evaluator.Evaluate(expected, actual);

        // Assert
        result.Should().BeTrue();
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewEvaluator()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IEvaluator.CreateNew>();

        // Act
        var evaluator1 = factory();
        var evaluator2 = factory();

        // Assert
        evaluator1.Id.Should().NotBe(evaluator2.Id);
    }
}
