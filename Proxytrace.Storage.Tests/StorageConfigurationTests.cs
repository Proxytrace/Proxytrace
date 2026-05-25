using AwesomeAssertions;
using Proxytrace.Storage.Internal;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class StorageConfigurationTests
{
    [TestMethod]
    public void InMemory_CreatesInMemoryConfiguration()
    {
        // Act
        var config = StorageConfiguration.InMemory();

        // Assert
        config.Should().NotBeNull();
        config.Should().BeOfType<InMemoryConfiguration>();
        config.CryptographyKeyBase64.Should().BeNull();
    }

    [TestMethod]
    public void InMemory_DoesNotSupportMigrations()
    {
        // Act
        var config = StorageConfiguration.InMemory();

        // Assert
        var inMemoryConfig = config as InMemoryConfiguration;
        inMemoryConfig.Should().NotBeNull();
        inMemoryConfig.SupportsMigrations.Should().BeFalse();
    }

    [TestMethod]
    public void SqlServer_WithConnectionString_CreatesSqlServerConfiguration()
    {
        // Arrange
        var connectionString = "Server=localhost;Database=TestDb;";

        // Act
        var config = StorageConfiguration.SqlServer(connectionString);

        // Assert
        config.Should().NotBeNull();
        config.Should().BeOfType<SqlServerConfiguration>();
        config.CryptographyKeyBase64.Should().BeNull();
    }

    [TestMethod]
    public void SqlServer_WithConnectionStringAndCryptographyKey_CreatesSqlServerConfiguration()
    {
        // Arrange
        var connectionString = "Server=localhost;Database=TestDb;";
        var cryptographyKey = "dGVzdC1jcnlwdG9ncmFwaHkta2V5";

        // Act
        var config = StorageConfiguration.SqlServer(connectionString, cryptographyKey);

        // Assert
        config.Should().NotBeNull();
        config.Should().BeOfType<SqlServerConfiguration>();
        config.CryptographyKeyBase64.Should().Be(cryptographyKey);
    }

    [TestMethod]
    public void SqlServer_SupportsMigrations()
    {
        // Arrange
        var connectionString = "Server=localhost;Database=TestDb;";

        // Act
        var config = StorageConfiguration.SqlServer(connectionString);

        // Assert
        var sqlServerConfig = config as SqlServerConfiguration;
        sqlServerConfig.Should().NotBeNull();
        sqlServerConfig.SupportsMigrations.Should().BeTrue();
    }

    [TestMethod]
    public void SqlServer_StoresConnectionString()
    {
        // Arrange
        var connectionString = "Server=localhost;Database=TestDb;Integrated Security=true;";

        // Act
        var config = StorageConfiguration.SqlServer(connectionString);

        // Assert
        var sqlServerConfig = config as SqlServerConfiguration;
        sqlServerConfig.Should().NotBeNull();
        sqlServerConfig.ConnectionString.Should().Be(connectionString);
    }
}
