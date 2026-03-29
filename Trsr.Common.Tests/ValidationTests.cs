using System.ComponentModel.DataAnnotations;
using AwesomeAssertions;
using JetBrains.Annotations;
using Trsr.Common.Validation;
// ReSharper disable PropertyCanBeMadeInitOnly.Local

namespace Trsr.Common.Tests;

[TestClass]
public sealed class ValidationTests
{
    [TestMethod]
    public void NotNullOrWhitespace_WithValidString_ReturnsSuccess()
    {
        // Arrange
        var validString = "Valid Input";

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhiteSpace(validString);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void NotNullOrWhitespace_WithNull_ReturnsError()
    {
        // Arrange
        string? nullString = null;

        // Act
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhiteSpace(nullString!);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
        result.ErrorMessage.Should().Contain("cannot be empty");
    }

    [TestMethod]
    public void NotNullOrWhitespace_WithEmptyString_ReturnsError()
    {
        // Arrange
        var emptyString = string.Empty;

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhiteSpace(emptyString);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
        result.ErrorMessage.Should().Contain("cannot be empty");
    }

    [TestMethod]
    public void NotNullOrWhitespace_WithWhitespaceString_ReturnsError()
    {
        // Arrange
        var whitespaceString = "   ";

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhiteSpace(whitespaceString);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
        result.ErrorMessage.Should().Contain("cannot be empty");
    }

    [TestMethod]
    public void NotNullOrWhitespace_WithTabs_ReturnsError()
    {
        // Arrange
        var tabString = "\t\t\t";

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhiteSpace(tabString);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
    }

    [TestMethod]
    public void NotNullOrWhitespace_WithNewlines_ReturnsError()
    {
        // Arrange
        var newlineString = "\n\r\n";

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhiteSpace(newlineString);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
    }

    [TestMethod]
    public void NotDefault_WithNonDefaultInt_ReturnsSuccess()
    {
        // Arrange
        var nonDefaultInt = 42;

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotDefault(nonDefaultInt);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void NotDefault_WithDefaultInt_ReturnsError()
    {
        // Arrange
        var defaultInt = 0;

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotDefault(defaultInt);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
        result.ErrorMessage.Should().Contain("cannot be default");
    }

    [TestMethod]
    public void NotDefault_WithNonDefaultGuid_ReturnsSuccess()
    {
        // Arrange
        var nonDefaultGuid = Guid.NewGuid();

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotDefault(nonDefaultGuid);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void NotDefault_WithDefaultGuid_ReturnsError()
    {
        // Arrange
        var defaultGuid = Guid.Empty;

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotDefault(defaultGuid);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
        result.ErrorMessage.Should().Contain("cannot be default");
    }

    [TestMethod]
    public void NotDefault_WithNonDefaultDateTimeOffset_ReturnsSuccess()
    {
        // Arrange
        var nonDefaultDate = DateTimeOffset.Now;

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotDefault(nonDefaultDate);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void NotDefault_WithDefaultDateTimeOffset_ReturnsError()
    {
        // Arrange
        var defaultDate = default(DateTimeOffset);

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotDefault(defaultDate);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
    }

    [TestMethod]
    public void InPast_WithPastDate_ReturnsSuccess()
    {
        // Arrange
        var pastDate = DateTimeOffset.UtcNow.AddDays(-1);

        // Act
        var result = global::Trsr.Common.Validation.Validation.InPast(pastDate);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void InPast_WithFutureDate_ReturnsError()
    {
        // Arrange
        var futureDate = DateTimeOffset.UtcNow.AddDays(1);

        // Act
        var result = global::Trsr.Common.Validation.Validation.InPast(futureDate);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
        result.ErrorMessage.Should().Contain("must be in the past");
    }

    [TestMethod]
    public void InPast_WithCurrentMoment_ReturnsSuccess()
    {
        // Arrange
        // Current time should be considered "in the past" or at least not in the future
        var now = DateTimeOffset.UtcNow;

        // Act
        var result = global::Trsr.Common.Validation.Validation.InPast(now);

        // Assert
        // This might pass or fail depending on microsecond precision,
        // but generally should pass since we're not > UtcNow
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void NotBefore_WithDateAfterMinValue_ReturnsSuccess()
    {
        // Arrange
        var minValue = DateTimeOffset.UtcNow.AddDays(-10);
        var testDate = DateTimeOffset.UtcNow.AddDays(-5);

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotBefore(testDate, minValue);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void NotBefore_WithDateBeforeMinValue_ReturnsError()
    {
        // Arrange
        var minValue = DateTimeOffset.UtcNow.AddDays(-5);
        var testDate = DateTimeOffset.UtcNow.AddDays(-10);

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotBefore(testDate, minValue);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
        result.ErrorMessage.Should().Contain("cannot be before");
    }

    [TestMethod]
    public void NotBefore_WithDateEqualToMinValue_ReturnsSuccess()
    {
        // Arrange
        var minValue = DateTimeOffset.UtcNow;
        var testDate = minValue;

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotBefore(testDate, minValue);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void ValidationResults_IncludeMemberName()
    {
        // Arrange
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhiteSpace(string.Empty);

        // Assert
        result.MemberNames.Should().NotBeEmpty();
        // CallerMemberName captures the calling method name, which is the test method name
        result.MemberNames.Should().Contain("ValidationResults_IncludeMemberName");
    }

    [TestMethod]
    public void NotDefault_WithCustomType_ReturnsError()
    {
        // Arrange
        var defaultValue = default(TestStruct);

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotDefault(defaultValue);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBe(ValidationResult.Success);
    }

    [TestMethod]
    public void NotDefault_WithNonDefaultCustomType_ReturnsSuccess()
    {
        // Arrange
        var nonDefaultValue = new TestStruct { Value = 42 };

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotDefault(nonDefaultValue);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void Validate_WithValidObject_DoesNotThrow()
    {
        // Arrange
        var validObject = new ValidatableTestObject { Name = "Valid Name", Age = 25 };

        // Act & Assert
        var action = () => validObject.Validate();
        action.Should().NotThrow();
    }

    [TestMethod]
    public void Validate_WithInvalidObject_ThrowsValidationException()
    {
        // Arrange
        var invalidObject = new ValidatableTestObject { Name = "", Age = 25 };

        // Act & Assert
        var action = () => invalidObject.Validate();
        action.Should().Throw<ValidationException>();
    }

    [TestMethod]
    public void Validate_WithMultipleValidationErrors_ThrowsValidationException()
    {
        // Arrange
        var invalidObject = new ValidatableTestObject { Name = "", Age = -5 };

        // Act & Assert
        var action = () => invalidObject.Validate();
        action.Should().Throw<ValidationException>();
    }

    private class ValidatableTestObject : IValidatableObject
    {
        public string Name { get; set; } = string.Empty;
        public int Age { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (string.IsNullOrWhiteSpace(Name))
            {
                yield return new ValidationResult("Name is required", [nameof(Name)]);
            }

            if (Age < 0)
            {
                yield return new ValidationResult("Age must be non-negative", [nameof(Age)]);
            }
        }
    }

    private struct TestStruct
    {
        public int Value { [UsedImplicitly] get; set; }
    }
}
