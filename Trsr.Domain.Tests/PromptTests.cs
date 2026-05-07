using AwesomeAssertions;
using Trsr.Domain.Prompt;

// ReSharper disable NullableWarningSuppressionIsUsed

namespace Trsr.Domain.Tests;

[TestClass]
public class PromptTests
{
    [TestMethod]
    public void Append_ShouldCombineNamesWithUnderscore()
    {
        // Arrange
        var prompt1 = new Prompt("FirstPrompt", "First content");
        var prompt2 = new Prompt("SecondPrompt", "Second content");

        // Act
        IPrompt result = prompt1.Append(prompt2);

        // Assert
        result.Name.Should().Be("FirstPrompt_SecondPrompt");
    }

    [TestMethod]
    public void Append_ShouldCombinePromptStringsWithNewLine()
    {
        // Arrange
        var prompt1 = new Prompt("Prompt1", "First content");
        var prompt2 = new Prompt("Prompt2", "Second content");

        // Act
        IPrompt result = prompt1.Append(prompt2);

        // Assert
        string expected = string.Join(Environment.NewLine, "First content", "Second content");
        result.ToPromptString().Should().Be(expected);
    }

    [TestMethod]
    public void Append_ShouldReturnNewInstance()
    {
        // Arrange
        var prompt1 = new Prompt("Prompt1", "Content1");
        var prompt2 = new Prompt("Prompt2", "Content2");

        // Act
        IPrompt result = prompt1.Append(prompt2);

        // Assert
        result.Should().NotBeSameAs(prompt1);
        result.Should().NotBeSameAs(prompt2);
    }

    [TestMethod]
    public void Append_ShouldNotModifyOriginalPrompts()
    {
        // Arrange
        var prompt1 = new Prompt("Original1", "Content1");
        var prompt2 = new Prompt("Original2", "Content2");

        // Act
        _ = prompt1.Append(prompt2);

        // Assert
        prompt1.Name.Should().Be("Original1");
        prompt1.ToPromptString().Should().Be("Content1");
        prompt2.Name.Should().Be("Original2");
        prompt2.ToPromptString().Should().Be("Content2");
    }

    [TestMethod]
    public void Append_WithMultipleAppends_ShouldChainCorrectly()
    {
        // Arrange
        var prompt1 = new Prompt("First", "Content1");
        var prompt2 = new Prompt("Second", "Content2");
        var prompt3 = new Prompt("Third", "Content3");

        // Act
        IPrompt result = prompt1.Append(prompt2).Append(prompt3);

        // Assert
        result.Name.Should().Be("First_Second_Third");
        string expectedContent = string.Join(Environment.NewLine, 
            "Content1", 
            "Content2", 
            "Content3");
        result.ToPromptString().Should().Be(expectedContent);
    }

    [TestMethod]
    public void Append_WithMultiLineContent_ShouldPreserveFormatting()
    {
        // Arrange
        var prompt1 = new Prompt("Prompt1", "Line1\nLine2");
        var prompt2 = new Prompt("Prompt2", "Line3\nLine4");

        // Act
        IPrompt result = prompt1.Append(prompt2);

        // Assert
        result.ToPromptString().Should().Contain("Line1\nLine2");
        result.ToPromptString().Should().Contain("Line3\nLine4");
    }

    [TestMethod]
    public void Constructor_WithValidParameters_ShouldCreatePrompt()
    {
        // Arrange & Act
        var prompt = new Prompt("TestName", "Test content");

        // Assert
        prompt.Should().NotBeNull();
        prompt.Name.Should().Be("TestName");
        prompt.ToPromptString().Should().Be("Test content");
    }

    [TestMethod]
    public void Constructor_WithNullName_ShouldThrowArgumentException()
    {
        // Act & Assert
        FluentActions.Invoking(() => new Prompt(null!, "Content"))
            .Should()
            .Throw<ArgumentNullException>();
    }

    [TestMethod]
    public void Constructor_WithEmptyName_ShouldThrowArgumentException()
    {
        // Act & Assert
        FluentActions.Invoking(() => new Prompt(string.Empty, "Content"))
            .Should()
            .Throw<ArgumentNullException>();
    }

    [TestMethod]
    public void Constructor_WithWhitespaceName_ShouldThrowArgumentException()
    {
        // Act & Assert
        FluentActions.Invoking(() => new Prompt("   ", "Content"))
            .Should()
            .Throw<ArgumentNullException>();
    }

    [TestMethod]
    public void Constructor_WithNullPromptString_ShouldThrowArgumentException()
    {
        // Act & Assert
        FluentActions.Invoking(() => new Prompt("Name", null!))
            .Should()
            .Throw<ArgumentNullException>();
    }

    [TestMethod]
    public void Constructor_WithEmptyPromptString_ShouldThrowArgumentException()
    {
        // Act & Assert
        FluentActions.Invoking(() => new Prompt("Name", string.Empty))
            .Should()
            .Throw<ArgumentNullException>();
    }

    [TestMethod]
    public void ToPromptString_ShouldReturnOriginalContent()
    {
        // Arrange
        const string content = "This is the prompt content";
        var prompt = new Prompt("TestPrompt", content);

        // Act
        string result = prompt.ToPromptString();

        // Assert
        result.Should().Be(content);
    }
}