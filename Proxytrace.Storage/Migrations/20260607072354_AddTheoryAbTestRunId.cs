using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddTheoryAbTestRunId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ABTestRunId",
                table: "OptimizationTheoryEntity",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationTheoryEntity_ABTestRunId",
                table: "OptimizationTheoryEntity",
                column: "ABTestRunId");

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationTheoryEntity_TestRunEntity_ABTestRunId",
                table: "OptimizationTheoryEntity",
                column: "ABTestRunId",
                principalTable: "TestRunEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationTheoryEntity_TestRunEntity_ABTestRunId",
                table: "OptimizationTheoryEntity");

            migrationBuilder.DropIndex(
                name: "IX_OptimizationTheoryEntity_ABTestRunId",
                table: "OptimizationTheoryEntity");

            migrationBuilder.DropColumn(
                name: "ABTestRunId",
                table: "OptimizationTheoryEntity");
        }
    }
}
