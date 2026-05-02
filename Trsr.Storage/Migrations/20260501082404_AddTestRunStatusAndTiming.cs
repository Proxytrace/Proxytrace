using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddTestRunStatusAndTiming : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAt",
                table: "TestRunEntity",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 2); // 2 = Completed — existing rows were synchronous, so already done

            migrationBuilder.AddColumn<Guid>(
                name: "Suite",
                table: "TestRunEntity",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DurationMs",
                table: "TestResultEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            // Backfill CompletedAt for all existing (completed) runs
            migrationBuilder.Sql("UPDATE TestRunEntity SET CompletedAt = Timestamp WHERE CompletedAt IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunEntity_Suite",
                table: "TestRunEntity",
                column: "Suite");

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_TestSuiteEntity_Suite",
                table: "TestRunEntity",
                column: "Suite",
                principalTable: "TestSuiteEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_TestSuiteEntity_Suite",
                table: "TestRunEntity");

            migrationBuilder.DropIndex(
                name: "IX_TestRunEntity_Suite",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "Suite",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "DurationMs",
                table: "TestResultEntity");
        }
    }
}
