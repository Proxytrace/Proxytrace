using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddOptimizationProposal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OptimizationProposalEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Agent = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Rationale = table.Column<string>(type: "text", nullable: false),
                    ProposedSystemMessage = table.Column<string>(type: "text", nullable: true),
                    ProposedTools = table.Column<string>(type: "text", nullable: false),
                    EvidenceTestRunIds = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OptimizationProposalEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OptimizationProposalEntity_AgentEntity_Agent",
                        column: x => x.Agent,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Agent",
                table: "OptimizationProposalEntity",
                column: "Agent");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Status",
                table: "OptimizationProposalEntity",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OptimizationProposalEntity");
        }
    }
}
