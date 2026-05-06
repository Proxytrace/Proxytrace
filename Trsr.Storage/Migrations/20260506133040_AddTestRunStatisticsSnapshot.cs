using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddTestRunStatisticsSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StatTestCases",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "StatTotalDurationMs",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "InputTokens",
                table: "TestResultEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "OutputTokens",
                table: "TestResultEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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

            migrationBuilder.DropColumn(
                name: "InputTokens",
                table: "TestResultEntity");

            migrationBuilder.DropColumn(
                name: "OutputTokens",
                table: "TestResultEntity");
        }
    }
}
