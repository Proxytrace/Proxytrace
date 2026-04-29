using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AgentCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationProposalEntity_AgentEntity_Agent",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_AgentEntity_Agent",
                table: "TestRunEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_TestSuiteEntity_AgentEntity_Agent",
                table: "TestSuiteEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_AgentCallEntity_AgentEntity_AgentId",
                table: "AgentCallEntity",
                column: "AgentId",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationProposalEntity_AgentEntity_Agent",
                table: "OptimizationProposalEntity",
                column: "Agent",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_AgentEntity_Agent",
                table: "TestRunEntity",
                column: "Agent",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TestSuiteEntity_AgentEntity_Agent",
                table: "TestSuiteEntity",
                column: "Agent",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentCallEntity_AgentEntity_AgentId",
                table: "AgentCallEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationProposalEntity_AgentEntity_Agent",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_AgentEntity_Agent",
                table: "TestRunEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_TestSuiteEntity_AgentEntity_Agent",
                table: "TestSuiteEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationProposalEntity_AgentEntity_Agent",
                table: "OptimizationProposalEntity",
                column: "Agent",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_AgentEntity_Agent",
                table: "TestRunEntity",
                column: "Agent",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TestSuiteEntity_AgentEntity_Agent",
                table: "TestSuiteEntity",
                column: "Agent",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
