using Trsr.Prompting.Internal;
using Trsr.Testing;

namespace Trsr.Prompting.Tests;

[TestClass]
public class ResourcesPromptRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetAsync_TemplateExists_ReturnsTemplate()
    {
        // Arrange
        ResourcesPromptRepository repository = new ResourcesPromptRepository([Prompts.ResourceManager]);
        var templateName = "Test";

        // Act
        var template = await repository.GetAsync(templateName);

        // Assert
        Assert.IsNotNull(template);
        Assert.AreEqual(templateName, template.Name);
        Assert.AreEqual("foobar", template.Template);
    }
    
    [TestMethod]
    public async Task GetAsync_TemplateDoesNotExist_ReturnsNull()
    {
        // Arrange
        ResourcesPromptRepository repository = new ResourcesPromptRepository([Prompts.ResourceManager]);
        var templateName = "DoesNotExist";

        // Act
        var template = await repository.GetAsync(templateName);

        // Assert
        Assert.IsNull(template);
    }
}