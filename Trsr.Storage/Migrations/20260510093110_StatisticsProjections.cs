#nullable disable

using Microsoft.EntityFrameworkCore.Migrations;

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class StatisticsProjections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StatCost",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "StatInputTokens",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "StatOutputTokens",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "StatPassed",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "StatTestCases",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "StatTotalDurationMs",
                table: "TestRunEntity");

            migrationBuilder.CreateTable(
                name: "TestRunStatsEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TestRunId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AgentId = table.Column<Guid>(type: "TEXT", nullable: false),
                    EndpointId = table.Column<Guid>(type: "TEXT", nullable: false),
                    GroupId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SuiteId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TestCases = table.Column<int>(type: "INTEGER", nullable: false),
                    Passed = table.Column<int>(type: "INTEGER", nullable: false),
                    InputTokens = table.Column<long>(type: "INTEGER", nullable: true),
                    OutputTokens = table.Column<long>(type: "INTEGER", nullable: true),
                    TotalDurationMicroseconds = table.Column<long>(type: "INTEGER", nullable: true),
                    Cost = table.Column<decimal>(type: "TEXT", nullable: true),
                    RunCompletedAt = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRunStatsEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestRunStatsEntity_TestRunEntity_TestRunId",
                        column: x => x.TestRunId,
                        principalTable: "TestRunEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_AgentId",
                table: "TestRunStatsEntity",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_EndpointId",
                table: "TestRunStatsEntity",
                column: "EndpointId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_GroupId",
                table: "TestRunStatsEntity",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_RunCompletedAt",
                table: "TestRunStatsEntity",
                column: "RunCompletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_SuiteId",
                table: "TestRunStatsEntity",
                column: "SuiteId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_TestRunId",
                table: "TestRunStatsEntity",
                column: "TestRunId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TestRunStatsEntity");

            migrationBuilder.AddColumn<decimal>(
                name: "StatCost",
                table: "TestRunEntity",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "StatInputTokens",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "StatOutputTokens",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StatPassed",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "StatTestCases",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "StatTotalDurationMs",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: true);
        }
    }
}
