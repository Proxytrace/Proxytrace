using System.ComponentModel.DataAnnotations;
using System.Runtime.Serialization;
using System.Text.Json;
using AwesomeAssertions;
using JetBrains.Annotations;
using Microsoft.Testing.Platform.Services;
using Trsr.Common.Validation;
using Trsr.Testing;
using JsonSerializer = System.Text.Json.JsonSerializer;
using Trsr.Serialization.Internal;

// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable MemberCanBePrivate.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Trsr.Serialization.Tests;

[TestClass]
public class IOutputParserTests : BaseTest<Module>
{
    public class SimpleModel
    {
        public string Name { get; set; } = string.Empty;
        public int Age { get; set; }
        public bool IsActive { get; set; }
    }

    [UsedImplicitly]
    public class ModelWithValidation : IValidatableObject
    {
        public string RequiredField { get; set; } = string.Empty;

        [Range(1, 100)] public int Age { get; set; }

        public void Validate()
        {

        }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            yield return Validation.NotNullOrWhiteSpace(RequiredField, nameof(RequiredField));
            yield return Validation.InRange(Age, 1, 100, nameof(Age));
        }
    }

    public enum TestEnum
    {
        FirstValue,
        SecondValue,
        ThirdValue
    }

    [UsedImplicitly]
    public class ModelWithEnum
    {
        public TestEnum Status { get; set; }
        public string Description { get; set; } = string.Empty;
    }

    public class ComplexModel
    {
        public SimpleModel? NestedModel { get; set; }
        public List<string> Items { get; set; } = new();
        public Dictionary<string, int> Scores { get; set; } = new();
        public TestEnum Status { get; set; }
    }

    [UsedImplicitly]
    public class NullableModel
    {
        public string? OptionalString { get; set; }
        public int? OptionalInt { get; set; }
        public DateTime? OptionalDate { get; set; }
    }

    [UsedImplicitly]
    public class ModelWithDescription
    {
        [System.ComponentModel.Description("The action that was requested to be performed")]
        public string RequestedAction { get; set; } = string.Empty;
        
        [System.ComponentModel.Description("The unique identifier for the actor")]
        public Guid ActorId { get; set; }
        
        [System.ComponentModel.Description("The status of the operation")]
        public TestEnum Status { get; set; }
    }

    [TestMethod]
    public void SchemaDefinition_SimpleModel_ReturnsValidJsonSchema()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();

        // Act
        string schema = parser.Format.As<JsonOutputFormat>().Schema;

        // Assert
        schema.Should().NotBeNullOrWhiteSpace();

        // Verify it's valid JSON
        JsonDocument.Parse(schema);

        // Verify schema contains expected properties
        schema.Should().Contain("Name");
        schema.Should().Contain("Age");
        schema.Should().Contain("IsActive");
    }

    [TestMethod]
    public void SchemaDefinition_ModelWithEnum_ContainsEnumValues()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithEnum>>();

        // Act
        string schema = parser.Format.As<JsonOutputFormat>().Schema;

        // Assert
        schema.Should().NotBeNullOrWhiteSpace();

        // Verify schema contains enum values in camelCase
        schema.Should().Contain("firstValue");
        schema.Should().Contain("secondValue");
        schema.Should().Contain("thirdValue");
    }

    [TestMethod]
    public void SchemaDefinition_ComplexModel_ContainsNestedStructures()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ComplexModel>>();

        // Act
        string schema = parser.Format.As<JsonOutputFormat>().Schema;

        // Assert
        schema.Should().NotBeNullOrWhiteSpace();
        JsonDocument.Parse(schema); // Verify valid JSON

        schema.Should().Contain("NestedModel");
        schema.Should().Contain("Items");
        schema.Should().Contain("Scores");
        schema.Should().Contain("Status");
    }

    [TestMethod]
    public void SchemaDefinition_NullableModel_HandlesNullableProperties()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<NullableModel>>();

        // Act
        string schema = parser.Format.As<JsonOutputFormat>().Schema;

        // Assert
        schema.Should().NotBeNullOrWhiteSpace();
        JsonDocument.Parse(schema); // Verify valid JSON

        schema.Should().Contain("OptionalString");
        schema.Should().Contain("OptionalInt");
        schema.Should().Contain("OptionalDate");
    }

    [TestMethod]
    public void SchemaDefinition_SameTypeMultipleParsers_ReturnsSameSchema()
    {
        // Arrange
        var serviceProvider = GetServices();
        var parser1 = serviceProvider.GetRequiredService<IOutputParser<SimpleModel>>();
        var parser2 = serviceProvider.GetRequiredService<IOutputParser<SimpleModel>>();

        // Act
        string schema1 = parser1.Format.As<JsonOutputFormat>().Schema;
        string schema2 = parser2.Format.As<JsonOutputFormat>().Schema;

        // Assert
        schema1.Should().Be(schema2);
    }

    [TestMethod]
    public async Task ParseAsync_ValidSimpleJson_ReturnsDeserializedObject()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string json = """{"name":"John","age":30,"isActive":true}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("John");
        result.Age.Should().Be(30);
        result.IsActive.Should().BeTrue();
    }

    [TestMethod]
    public async Task ParseAsync_ValidJsonWithWhitespace_ReturnsDeserializedObject()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string json = """
                      {
                          "name": "Jane",
                          "age": 25,
                          "isActive": false
                      }
                      """;

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("Jane");
        result.Age.Should().Be(25);
        result.IsActive.Should().BeFalse();
    }

    [TestMethod]
    public async Task ParseAsync_EnumAsString_ParsesCorrectly()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithEnum>>();
        string json = """{"status":"firstValue","description":"Test"}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.Status.Should().Be(TestEnum.FirstValue);
        result.Description.Should().Be("Test");
    }

    [TestMethod]
    public async Task ParseAsync_EnumAsInteger_ParsesCorrectly()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithEnum>>();
        string json = """{"status":1,"description":"Test"}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.Status.Should().Be(TestEnum.SecondValue);
        result.Description.Should().Be("Test");
    }

    [TestMethod]
    public async Task ParseAsync_ComplexModel_ParsesCorrectly()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ComplexModel>>();
        string json = """
                      {
                          "nestedModel": {"name":"Nested","age":20,"isActive":true},
                          "items": ["item1","item2","item3"],
                          "scores": {"math":95,"science":87},
                          "status": "secondValue"
                      }
                      """;

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.NestedModel.Should().NotBeNull();
        result.NestedModel!.Name.Should().Be("Nested");
        result.NestedModel.Age.Should().Be(20);
        result.NestedModel.IsActive.Should().BeTrue();
        result.Items.Should().BeEquivalentTo("item1", "item2", "item3");
        result.Scores.Should().ContainKey("math").WhoseValue.Should().Be(95);
        result.Scores.Should().ContainKey("science").WhoseValue.Should().Be(87);
        result.Status.Should().Be(TestEnum.SecondValue);
    }

    [TestMethod]
    public async Task ParseAsync_NullableProperties_ParsesCorrectly()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<NullableModel>>();
        string json = """{"optionalString":"test","optionalInt":42,"optionalDate":"2023-01-01T00:00:00Z"}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.OptionalString.Should().Be("test");
        result.OptionalInt.Should().Be(42);
        result.OptionalDate.Should().Be(new DateTime(2023, 1, 1, 0, 0, 0, DateTimeKind.Utc));
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow(" ")]
    [DataRow("null")]
    [DataRow("\"null\"")]
    [DataRow("\"null\"\r\n")]
    public async Task ParseAsync_NullableListWithNull_ReturnNull(string? data)
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<IReadOnlyList<string>>>();

        var result = await parser.ParseAsync(data);
        result.Should().BeNull();
    }

    [TestMethod]
    public async Task ParseAsync_NullablePropertiesWithNulls_ParsesCorrectly()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<NullableModel>>();
        string json = """{"optionalString":null,"optionalInt":null,"optionalDate":null}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.OptionalString.Should().BeNull();
        result.OptionalInt.Should().BeNull();
        result.OptionalDate.Should().BeNull();
    }

    [TestMethod]
    public async Task ParseAsync_ValidModelWithValidation_PassesValidation()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithValidation>>();
        string json = """{"requiredField":"Valid Value","age":25}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.RequiredField.Should().Be("Valid Value");
        result.Age.Should().Be(25);
    }

    [TestMethod]
    public async Task ParseAsync_JsonWithCodeBlockMarkdown_TrimsArtifacts()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string jsonWithArtifacts = """
                                   ```json
                                   {"name":"John","age":30,"isActive":true}
                                   ```
                                   """;

        // Act
        var result = await parser.ParseAsync(jsonWithArtifacts);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("John");
        result.Age.Should().Be(30);
        result.IsActive.Should().BeTrue();
    }

    [TestMethod]
    public async Task ParseAsync_JsonWithLanguageSpecifier_TrimsArtifacts()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string jsonWithArtifacts = """
                                   ```csharp
                                   {"name":"John","age":30,"isActive":true}
                                   ```
                                   """;

        // Act
        var result = await parser.ParseAsync(jsonWithArtifacts);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("John");
    }

    [TestMethod]
    public async Task ParseAsync_JsonWithCommonPrefixes_TrimsArtifacts()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();

        var testCases = new[]
        {
            """json: {"name":"John","age":30,"isActive":true}""",
            """Output: {"name":"John","age":30,"isActive":true}""",
            """Result: {"name":"John","age":30,"isActive":true}""",
            """Response: {"name":"John","age":30,"isActive":true}"""
        };

        foreach (string testCase in testCases)
        {
            // Act
            var result = await parser.ParseAsync(testCase);

            // Assert
            result.Should().NotBeNull();
            result.Name.Should().Be("John");
            result.Age.Should().Be(30);
            result.IsActive.Should().BeTrue();
        }
    }

    [TestMethod]
    [DataRow("28c50307-b609-4c23-ae7d-c5e51f636a82")]
    public async Task ParseAsync_Guid_works(string input)
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<Guid>>();

        // Act
        Guid? result = await parser.ParseAsync(input);

        // Assert
        result.Should().NotBeNull();
        result.Should().Be(Guid.Parse(input));
    }

    [TestMethod]
    public async Task ParseAsync_JsonWithOnlyOpeningBackticks_TrimsArtifacts()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string jsonWithArtifacts = """```{"name":"John","age":30,"isActive":true}""";

        // Act
        var result = await parser.ParseAsync(jsonWithArtifacts);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("John");
    }

    [TestMethod]
    public async Task ParseAsync_JsonWithOnlyClosingBackticks_TrimsArtifacts()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string jsonWithArtifacts = """{"name":"John","age":30,"isActive":true}```""";

        // Act
        var result = await parser.ParseAsync(jsonWithArtifacts);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("John");
    }

    [TestMethod]
    public async Task ParseAsync_EmptyString_ReturnsNull()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();

        var result = await parser.ParseAsync(string.Empty);
        result.Should().BeNull();
    }

    [TestMethod]
    public async Task ParseAsync_WhitespaceOnly_ReturnsEmptyAfterTrimming()
    {
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        var result = await parser.ParseAsync("   \n\t   ");
        result.Should().BeNull();
    }

    [TestMethod]
    public async Task ParseAsync_InvalidJson_ThrowsSerializationException()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string invalidJson = """{"name":"John","age":30,"isActive":""";

        // Act & Assert
        await parser.Invoking(p => p.ParseAsync(invalidJson))
            .Should()
            .ThrowAsync<SerializationException>();
    }

    [TestMethod]
    public async Task ParseAsync_JsonReturningNull_ReturnNull()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string nullJson = "null";

        var result = await parser.ParseAsync(nullJson);
        result.Should().BeNull();
    }

    [TestMethod]
    public async Task ParseAsync_ModelWithValidationErrors_ThrowsValidationException()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithValidation>>();
        string invalidJson = """{"requiredField":"","age":150}""";

        // Act & Assert
        await parser.Invoking(p => p.ParseAsync(invalidJson))
            .Should()
            .ThrowAsync<SerializationException>();
    }

    [TestMethod]
    public async Task ParseAsync_ModelWithValidationEmptyRequiredField_ThrowsValidationException()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithValidation>>();
        string invalidJson = """{"requiredField":"","age":25}""";

        // Act & Assert
        await parser.Invoking(p => p.ParseAsync(invalidJson))
            .Should().ThrowAsync<SerializationException>();
    }

    [TestMethod]
    public async Task ParseAsync_ModelWithValidationInvalidAge_ThrowsValidationException()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithValidation>>();
        string invalidJson = """{"requiredField":"Valid","age":0}""";

        // Act & Assert
        await parser.Invoking(p => p.ParseAsync(invalidJson))
            .Should().ThrowAsync<SerializationException>();
    }

    [TestMethod]
    public async Task ParseAsync_IncorrectJsonStructure_ThrowsSerializationException()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string wrongStructure = """["array","instead","of","object"]""";

        // Act & Assert
        await parser.Invoking(p => p.ParseAsync(wrongStructure))
            .Should().ThrowAsync<SerializationException>();
    }

    [TestMethod]
    public async Task ParseAsync_InvalidEnumValue_ThrowsSerializationException()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithEnum>>();
        string invalidEnum = """{"status":"invalidValue","description":"Test"}""";

        // Act & Assert
        await parser.Invoking(p => p.ParseAsync(invalidEnum))
            .Should().ThrowAsync<SerializationException>();
    }

    [TestMethod]
    public void SchemaDefinition_ModelWithDescription_ContainsDescriptions()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithDescription>>();

        // Act
        string schema = parser.Format.As<JsonOutputFormat>().Schema;

        // Assert
        schema.Should().NotBeNullOrWhiteSpace();

        // Verify it's valid JSON
        JsonDocument.Parse(schema);

        // Verify schema contains description attributes
        schema.Should().Contain("The action that was requested to be performed");
        schema.Should().Contain("The unique identifier for the actor");
        schema.Should().Contain("The status of the operation");
        
        // Verify the properties exist
        schema.Should().Contain("RequestedAction");
        schema.Should().Contain("ActorId");
        schema.Should().Contain("Status");
    }

    [TestMethod]
    public async Task ParseAsync_ModelWithDescription_SuccessfullyParsed()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ModelWithDescription>>();
        Guid testGuid = Guid.NewGuid();
        string json = $$"""{"requestedAction":"TestAction","actorId":"{{testGuid}}","status":"secondValue"}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.RequestedAction.Should().Be("TestAction");
        result.ActorId.Should().Be(testGuid);
        result.Status.Should().Be(TestEnum.SecondValue);
    }

    [TestMethod]
    public async Task ParseAsync_WithCancellationToken_RespectsToken()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string json = """{"name":"John","age":30,"isActive":true}""";
        using var cts = new CancellationTokenSource();

        // Act
        var result = await parser.ParseAsync(json, cts.Token);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("John");
    }

    [TestMethod]
    public async Task ParseAsync_WithCancelledToken_ThrowsOperationCancelledException()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string json = """{"name":"John","age":30,"isActive":true}""";
        var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        // Act & Assert
        await parser.Invoking(p => p.ParseAsync(json, cts.Token))
            .Should()
            .ThrowAsync<OperationCanceledException>();
    }

    [TestMethod]
    public async Task ParseAsync_LargeJson_ParsesSuccessfully()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<ComplexModel>>();
        var items = Enumerable.Range(1, 1000).Select(i => $"item{i}").ToList();
        var scores = Enumerable.Range(1, 100).ToDictionary(i => $"subject{i}", i => i * 10);

        var model = new ComplexModel
        {
            NestedModel = new SimpleModel { Name = "Large Test", Age = 50, IsActive = true },
            Items = items,
            Scores = scores,
            Status = TestEnum.ThirdValue
        };

        string json = JsonSerializer.Serialize(model);

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().HaveCount(1000);
        result.Scores.Should().HaveCount(100);
        result.NestedModel.Should().NotBeNull();
        result.Status.Should().Be(TestEnum.ThirdValue);
    }

    [TestMethod]
    public async Task ParseAsync_UnicodeCharacters_ParsesCorrectly()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string json = """{"name":"João 你好 🌟","age":30,"isActive":true}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("João 你好 🌟");
        result.Age.Should().Be(30);
        result.IsActive.Should().BeTrue();
    }

    [TestMethod]
    public async Task ParseAsync_EscapedCharacters_ParsesCorrectly()
    {
        // Arrange
        var parser = GetServices().GetRequiredService<IOutputParser<SimpleModel>>();
        string json = """{"name":"Line1\nLine2\tTabbed\"Quoted\"","age":30,"isActive":true}""";

        // Act
        var result = await parser.ParseAsync(json);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("Line1\nLine2\tTabbed\"Quoted\"");
    }

    [TestMethod]
    public void Constructor_MultipleInstances_DoesNotThrow()
    {
        // Arrange & Act
        var serviceProvider = GetServices();
        var parser1 = serviceProvider.GetRequiredService<IOutputParser<SimpleModel>>();
        var parser2 = serviceProvider.GetRequiredService<IOutputParser<SimpleModel>>();
        var parser3 = serviceProvider.GetRequiredService<IOutputParser<ModelWithEnum>>();

        // Assert
        parser1.Should().NotBeNull();
        parser2.Should().NotBeNull();
        parser3.Should().NotBeNull();
        string schema1 = parser1.Format.As<JsonOutputFormat>().Schema;
        string schema2 = parser2.Format.As<JsonOutputFormat>().Schema;
        string schema3 = parser3.Format.As<JsonOutputFormat>().Schema;
        schema1.Should().Be(schema2);
        schema1.Should().NotBe(schema3);
    }

    [TestMethod]
    public async Task SerializeDictionaryArguments()
    {
        string json = """{"query":"DFS algorithm"}""";
        var serializer = GetServices().GetRequiredService<ISerializer>();
        var expected = new Dictionary<string, object?> { { "query", "DFS algorithm" } };
        var actual = await serializer.DeserializeAsync<Dictionary<string, object?>>(json);
        actual.Should().BeEquivalentTo(expected);
    }
}