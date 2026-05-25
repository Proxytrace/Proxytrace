using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddABTestRunToOptimizationProposal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ABTestRun is a non-nullable FK with no sensible default; wipe existing rows
            // so the new column doesn't violate the FK to TestRunEntity.
            migrationBuilder.Sql("DELETE FROM \"OptimizationProposalEntity\"");

            migrationBuilder.AddColumn<Guid>(
                name: "ABTestRun",
                table: "OptimizationProposalEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_ABTestRun",
                table: "OptimizationProposalEntity",
                column: "ABTestRun");

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationProposalEntity_TestRunEntity_ABTestRun",
                table: "OptimizationProposalEntity",
                column: "ABTestRun",
                principalTable: "TestRunEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationProposalEntity_TestRunEntity_ABTestRun",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropIndex(
                name: "IX_OptimizationProposalEntity_ABTestRun",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropColumn(
                name: "ABTestRun",
                table: "OptimizationProposalEntity");
        }
    }
}
