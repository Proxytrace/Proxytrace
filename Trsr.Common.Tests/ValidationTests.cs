using System.ComponentModel.DataAnnotations;
using AwesomeAssertions;

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
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhitespace(validString);

        // Assert
        result.Should().Be(ValidationResult.Success);
    }

    [TestMethod]
    public void NotNullOrWhitespace_WithNull_ReturnsError()
    {
        // Arrange
        string? nullString = null;

        // Act
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhitespace(nullString!);

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
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhitespace(emptyString);

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
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhitespace(whitespaceString);

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
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhitespace(tabString);

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
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhitespace(newlineString);

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
        var result = global::Trsr.Common.Validation.Validation.NotNullOrWhitespace(string.Empty);

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

    private struct TestStruct
    {
        public int Value { get; set; }
    }
}
