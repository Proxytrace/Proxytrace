using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalAdoption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AdoptedAgentVersionId",
                table: "OptimizationProposalEntity",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AdoptedAgentVersionNumber",
                table: "OptimizationProposalEntity",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AdoptedAt",
                table: "OptimizationProposalEntity",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AdoptedManually",
                table: "OptimizationProposalEntity",
                type: "boolean",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_AdoptedAgentVersionId",
                table: "OptimizationProposalEntity",
                column: "AdoptedAgentVersionId");

            migrationBuilder.AddForeignKey(
                name: "FK_OptimizationProposalEntity_AgentVersionEntity_AdoptedAgentV~",
                table: "OptimizationProposalEntity",
                column: "AdoptedAgentVersionId",
                principalTable: "AgentVersionEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OptimizationProposalEntity_AgentVersionEntity_AdoptedAgentV~",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropIndex(
                name: "IX_OptimizationProposalEntity_AdoptedAgentVersionId",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropColumn(
                name: "AdoptedAgentVersionId",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropColumn(
                name: "AdoptedAgentVersionNumber",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropColumn(
                name: "AdoptedAt",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropColumn(
                name: "AdoptedManually",
                table: "OptimizationProposalEntity");
        }
    }
}
