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
    public void Postgres_WithConnectionString_CreatesPostgresConfiguration()
    {
        // Arrange
        var connectionString = "Host=localhost;Port=5432;Database=TestDb;Username=u;Password=p";

        // Act
        var config = StorageConfiguration.Postgres(connectionString);

        // Assert
        config.Should().NotBeNull();
        config.Should().BeOfType<PostgresConfiguration>();
        config.CryptographyKeyBase64.Should().BeNull();
    }

    [TestMethod]
    public void Postgres_WithCryptographyKey_StoresKey()
    {
        // Arrange
        var connectionString = "Host=localhost;Port=5432;Database=TestDb;Username=u;Password=p";
        var cryptographyKey = "dGVzdC1jcnlwdG9ncmFwaHkta2V5";

        // Act
        var config = StorageConfiguration.Postgres(connectionString, cryptographyKey);

        // Assert
        config.Should().BeOfType<PostgresConfiguration>();
        config.CryptographyKeyBase64.Should().Be(cryptographyKey);
    }

    [TestMethod]
    public void Postgres_SupportsMigrations()
    {
        // Arrange
        var connectionString = "Host=localhost;Port=5432;Database=TestDb;Username=u;Password=p";

        // Act
        var config = StorageConfiguration.Postgres(connectionString);

        // Assert
        var postgresConfig = config as PostgresConfiguration;
        postgresConfig.Should().NotBeNull();
        postgresConfig.SupportsMigrations.Should().BeTrue();
    }

    [TestMethod]
    public void Postgres_StoresConnectionString()
    {
        // Arrange
        var connectionString = "Host=localhost;Port=5432;Database=TestDb;Username=u;Password=p";

        // Act
        var config = StorageConfiguration.Postgres(connectionString);

        // Assert
        var postgresConfig = config as PostgresConfiguration;
        postgresConfig.Should().NotBeNull();
        postgresConfig.ConnectionString.Should().Be(connectionString);
    }
}
