using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Proxytrace.Common.Async;
using Proxytrace.Domain;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Storage.Internal.Entities.TestSuite;

namespace Proxytrace.Storage.Internal.Entities.TestRunGroup;

internal class TestRunGroupConfig : AbstractEntityConfiguration<TestRunGroupEntity>, IMapper<ITestRunGroup, TestRunGroupEntity>
{
    private readonly IRepository<ITestSuite> suites;
    private readonly ITestRunGroup.CreateExisting factory;

    public TestRunGroupConfig(
        IRepository<ITestSuite> suites,
        ITestRunGroup.CreateExisting factory)
    {
        this.suites = suites;
        this.factory = factory;
    }

    public override void Configure(EntityTypeBuilder<TestRunGroupEntity> builder)
    {
        builder
            .HasOne<TestSuiteEntity>()
            .WithMany()
            .HasForeignKey(e => e.Suite)
            .OnDelete(DeleteBehavior.Cascade);
    }

    public async Task<ITestRunGroup> Map(TestRunGroupEntity stored, CancellationToken cancellationToken = default)
        => factory(
            suite: await suites.GetAsync(stored.Suite, cancellationToken),
            status: stored.Status,
            completedAt: stored.CompletedAt,
            existing: stored);

    public Task<TestRunGroupEntity> Map(ITestRunGroup domain, CancellationToken cancellationToken = default)
        => new TestRunGroupEntity
        {
            Id = domain.Id,
            Suite = domain.Suite.Id,
            Status = domain.Status,
            CompletedAt = domain.CompletedAt,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
