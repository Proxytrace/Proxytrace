using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Storage.Internal.Entities.Evaluator;

namespace Trsr.Storage.Internal.Entities.TestSuite;

internal class TestSuiteEvaluatorConfig : AbstractEntityConfiguration<TestSuiteEvaluatorEntity>
{
    public override void Configure(EntityTypeBuilder<TestSuiteEvaluatorEntity> builder)
    {
        builder.HasKey(e => new { e.TestSuiteId, e.EvaluatorId });

        builder
            .HasOne<TestSuiteEntity>()
            .WithMany(e => e.TestSuiteEvaluators)
            .HasForeignKey(e => e.TestSuiteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<EvaluatorEntity>()
            .WithMany()
            .HasForeignKey(e => e.EvaluatorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(e => e.EvaluatorId);
    }
}
