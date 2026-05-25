using System.ComponentModel.DataAnnotations;
using AwesomeAssertions;
using Proxytrace.Storage.Internal.Entities;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class EntityValidationTests
{
    [TestMethod]
    public void Validate_WithValidEntity_ReturnsSuccess()
    {
        // Arrange
        var entity = new TestEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
        };

        // Act
        var validationResults = entity.Validate(new ValidationContext(entity)).ToList();

        // Assert
        validationResults.Should().NotBeNull();
        validationResults.Should().AllSatisfy(result => result.Should().Be(ValidationResult.Success));
    }

    [TestMethod]
    public void Validate_WithDefaultId_ReturnsError()
    {
        // Arrange
        var entity = new TestEntity
        {
            Id = Guid.Empty,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
        };

        // Act
        var validationResults = entity.Validate(new ValidationContext(entity)).ToList();

        // Assert
        var errorResult = validationResults.FirstOrDefault(r => r != ValidationResult.Success);
        errorResult.Should().NotBeNull();
        errorResult.ErrorMessage.Should().Contain("Id");
    }

    [TestMethod]
    public void Validate_WithDefaultCreatedAt_ReturnsError()
    {
        // Arrange
        var entity = new TestEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = default,
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
        };

        // Act
        var validationResults = entity.Validate(new ValidationContext(entity)).ToList();

        // Assert
        var errorResult = validationResults.FirstOrDefault(r => r != ValidationResult.Success);
        errorResult.Should().NotBeNull();
        errorResult.ErrorMessage.Should().Contain("CreatedAt");
    }

    [TestMethod]
    public void Validate_WithFutureCreatedAt_ReturnsError()
    {
        // Arrange
        var entity = new TestEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow.AddDays(1),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
        };

        // Act
        var validationResults = entity.Validate(new ValidationContext(entity)).ToList();

        // Assert
        var errorResult = validationResults.FirstOrDefault(r => r != ValidationResult.Success);
        errorResult.Should().NotBeNull();
        errorResult.ErrorMessage.Should().Contain("CreatedAt").And.Contain("past");
    }

    [TestMethod]
    public void Validate_WithDefaultUpdatedAt_ReturnsError()
    {
        // Arrange
        var entity = new TestEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
            UpdatedAt = default
        };

        // Act
        var validationResults = entity.Validate(new ValidationContext(entity)).ToList();
        
        // Assert
        var errorResult = validationResults.FirstOrDefault(r => r != ValidationResult.Success);
        errorResult.Should().NotBeNull();
        errorResult.ErrorMessage.Should().Contain("UpdatedAt");
    }

    [TestMethod]
    public void Validate_WithFutureUpdatedAt_ReturnsError()
    {
        // Arrange
        var entity = new TestEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(1)
        };

        // Act
        var validationResults = entity.Validate(new ValidationContext(entity)).ToList();

        // Assert
        var errorResult = validationResults.FirstOrDefault(r => r != ValidationResult.Success);
        errorResult.Should().NotBeNull();
        errorResult.ErrorMessage.Should().Contain("UpdatedAt").And.Contain("past");
    }

    [TestMethod]
    public void Validate_WithAllInvalidFields_ReturnsMultipleErrors()
    {
        // Arrange
        var entity = new TestEntity
        {
            Id = Guid.Empty,
            CreatedAt = default,
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(1)
        };

        // Act
        var validationResults = entity.Validate(new ValidationContext(entity)).ToList();

        // Assert
        var errorResults = validationResults.Where(r => r != ValidationResult.Success).ToList();
        errorResults.Should().NotBeEmpty();
        errorResults.Count.Should().BeGreaterThanOrEqualTo(3);
    }

    private sealed record TestEntity : Entity;
}
