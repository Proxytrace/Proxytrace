using AwesomeAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Storage.Internal.Entities.AgentCall;
using Proxytrace.Storage.Internal.Entities.ModelEndpoint;
using Proxytrace.Storage.Internal.Entities.ModelProvider;
using Proxytrace.Storage.Internal.Entities.TestRun;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

/// <summary>
/// Guards the foreign keys that protect the high-volume <see cref="AgentCallEntity"/> traces table
/// from a cascade delete. A <c>Cascade</c> on either FK let a single hard delete of a config row
/// (a <c>ModelEndpoint</c> or, transitively, a <c>ModelProvider</c>) wipe every trace recorded
/// against it — irreversible telemetry loss (issue #191). Endpoints/providers are removed via the
/// archive flow, never hard-deleted, so these FKs must be <c>Restrict</c>.
/// <para>
/// The in-memory provider does not enforce <c>Restrict</c>/<c>Cascade</c> at runtime, so we assert
/// on the EF model metadata — which is what drives the SQL generated against PostgreSQL — rather
/// than on a delete round-trip. Same approach as <see cref="ConcurrencyTokenModelTests"/>.
/// </para>
/// </summary>
[TestClass]
public sealed class CascadeDeleteBehaviorModelTests : BaseTest<Module>
{
    [TestMethod]
    public void AgentCallToModelEndpoint_IsRestrict_SoDeletingAnEndpointCannotWipeTraces()
    {
        DeleteBehaviorFor<AgentCallEntity>(nameof(AgentCallEntity.EndpointId))
            .Should().Be(DeleteBehavior.Restrict,
                "a hard delete of a ModelEndpoint must never cascade-delete its AgentCall traces");
    }

    [TestMethod]
    public void ModelEndpointToModelProvider_IsRestrict_SoDeletingAProviderCannotWipeTraces()
    {
        DeleteBehaviorFor<ModelEndpointEntity>(nameof(ModelEndpointEntity.Provider))
            .Should().Be(DeleteBehavior.Restrict,
                "a hard delete of a ModelProvider must never cascade through its endpoints to the traces table");
    }

    [TestMethod]
    public void TestRunToModelEndpoint_IsRestrict_SoDeletingAnEndpointCannotWipeTestRuns()
    {
        DeleteBehaviorFor<TestRunEntity>(nameof(TestRunEntity.Endpoint))
            .Should().Be(DeleteBehavior.Restrict,
                "a hard delete of a ModelEndpoint must never cascade-delete its TestRun history");
    }

    private DeleteBehavior DeleteBehaviorFor<TEntity>(string foreignKeyPropertyName)
    {
        IServiceProvider services = GetServices();
        using var context = services.GetRequiredService<StorageDbContext>();

        var entityType = context.Model.FindEntityType(typeof(TEntity));
        entityType.Should().NotBeNull("{0} must be mapped", typeof(TEntity).Name);

        var foreignKey = entityType?
            .GetForeignKeys()
            .SingleOrDefault(fk => fk.Properties.Any(p => p.Name == foreignKeyPropertyName));
        foreignKey.Should().NotBeNull(
            "{0} must declare a foreign key on {1}", typeof(TEntity).Name, foreignKeyPropertyName);

        return foreignKey?.DeleteBehavior ?? DeleteBehavior.Cascade;
    }
}
