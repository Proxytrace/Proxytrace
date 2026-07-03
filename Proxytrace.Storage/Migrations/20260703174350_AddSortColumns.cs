using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddSortColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "CacheHitRate",
                table: "AgentCallEntity",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalTokens",
                table: "AgentCallEntity",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_CacheHitRate",
                table: "AgentCallEntity",
                column: "CacheHitRate");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_LatencyMs",
                table: "AgentCallEntity",
                column: "LatencyMs");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_ResponseToolRequestCount",
                table: "AgentCallEntity",
                column: "ResponseToolRequestCount");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_TotalTokens",
                table: "AgentCallEntity",
                column: "TotalTokens");

            migrationBuilder.Sql("""
                UPDATE "AgentCallEntity" SET "TotalTokens" = "InputTokens" + "OutputTokens"
                WHERE "InputTokens" IS NOT NULL AND "OutputTokens" IS NOT NULL;
                UPDATE "AgentCallEntity" SET "CacheHitRate" = COALESCE("CachedInputTokens", 0)::double precision / "InputTokens"
                WHERE "InputTokens" IS NOT NULL AND "InputTokens" > 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_CacheHitRate",
                table: "AgentCallEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_LatencyMs",
                table: "AgentCallEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_ResponseToolRequestCount",
                table: "AgentCallEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_TotalTokens",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "CacheHitRate",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "TotalTokens",
                table: "AgentCallEntity");
        }
    }
}
