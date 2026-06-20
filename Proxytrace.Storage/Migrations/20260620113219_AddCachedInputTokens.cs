using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddCachedInputTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "CachedInputTokens",
                table: "TestRunStatsEntity",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "CachedInputTokens",
                table: "TestResultEntity",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CachedInputTokenCost",
                table: "ModelEndpointEntity",
                type: "numeric(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CachedInputTokens",
                table: "AgentCallEntity",
                type: "numeric(20,0)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CachedInputTokens",
                table: "TestRunStatsEntity");

            migrationBuilder.DropColumn(
                name: "CachedInputTokens",
                table: "TestResultEntity");

            migrationBuilder.DropColumn(
                name: "CachedInputTokenCost",
                table: "ModelEndpointEntity");

            migrationBuilder.DropColumn(
                name: "CachedInputTokens",
                table: "AgentCallEntity");
        }
    }
}
