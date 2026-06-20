using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class CascadeSuiteDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationProposalEntity_TestRunEntity_ABTestRun",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationTheoryEntity_TestSuiteEntity_Suite",
                table: "OptimizationTheoryEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationProposalEntity_TestRunEntity_ABTestRun",
                table: "OptimizationProposalEntity",
                column: "ABTestRun",
                principalTable: "TestRunEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationTheoryEntity_TestSuiteEntity_Suite",
                table: "OptimizationTheoryEntity",
                column: "Suite",
                principalTable: "TestSuiteEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationProposalEntity_TestRunEntity_ABTestRun",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationTheoryEntity_TestSuiteEntity_Suite",
                table: "OptimizationTheoryEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationProposalEntity_TestRunEntity_ABTestRun",
                table: "OptimizationProposalEntity",
                column: "ABTestRun",
                principalTable: "TestRunEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationTheoryEntity_TestSuiteEntity_Suite",
                table: "OptimizationTheoryEntity",
                column: "Suite",
                principalTable: "TestSuiteEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
