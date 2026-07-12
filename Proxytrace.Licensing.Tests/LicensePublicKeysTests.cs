using AwesomeAssertions;

namespace Proxytrace.Licensing.Tests;

[TestClass]
public sealed class LicensePublicKeysTests
{
    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow("   ")]
    public void ParseOverride_WithoutOverride_ReturnsEmbeddedKey(string? overrideValue)
    {
        var keys = LicensePublicKeys.ParseOverride(overrideValue);

        keys.Should().ContainSingle()
            .Which.Should().StartWith("MFkw"); // base64 SPKI P-256 prefix
    }

    [TestMethod]
    public void ParseOverride_WithSingleKey_ReturnsOnlyThatKey()
    {
        var keys = LicensePublicKeys.ParseOverride("KEY-A");

        keys.Should().Equal("KEY-A");
    }

    [TestMethod]
    public void ParseOverride_WithCommaSeparatedKeys_SplitsAndTrims()
    {
        var keys = LicensePublicKeys.ParseOverride(" KEY-A , KEY-B ,, ");

        keys.Should().Equal("KEY-A", "KEY-B");
    }

    [TestMethod]
    public void GetActiveKeys_InThisTestBuild_ReturnsEmbeddedKey()
    {
        // The test project builds without the LicensePublicKey MSBuild property, so the
        // assembly-metadata override is absent and the embedded key wins.
        LicensePublicKeys.GetActiveKeys().Should().Equal(LicensePublicKeys.ParseOverride(null));
    }
}
