using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class TuneAgentCallAutovacuum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Keep planner statistics fresh on the product's highest-volume table. With the default
            // autovacuum_analyze_scale_factor (0.10) a large AgentCallEntity is only re-analyzed after
            // ~10% of its rows change, so the planner's row estimates lag far behind reality during
            // rapid ingestion. Stale/zero statistics make the statistics aggregates flip from a
            // parallel seq-scan aggregate to a nested-loop plan that random-reads the whole table —
            // multi-second at scale (issue #246). Lowering the scale factor (plus a flat threshold so
            // it still triggers on a smaller table) keeps the estimates current so the good plan holds.
            // PostgreSQL-only relational metadata; the in-memory provider ignores migrations.
            migrationBuilder.Sql(
                """
                ALTER TABLE "AgentCallEntity" SET (
                    autovacuum_analyze_scale_factor = 0.02,
                    autovacuum_analyze_threshold = 5000
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "AgentCallEntity" RESET (
                    autovacuum_analyze_scale_factor,
                    autovacuum_analyze_threshold
                );
                """);
        }
    }
}
