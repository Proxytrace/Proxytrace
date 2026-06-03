using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddOptimizationTheory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OptimizationTheoryEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Agent = table.Column<Guid>(type: "uuid", nullable: false),
                    Suite = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Rationale = table.Column<string>(type: "text", nullable: false),
                    Data = table.Column<string>(type: "text", nullable: false),
                    EvidenceTestRunIds = table.Column<string>(type: "text", nullable: false),
                    ResultingProposalId = table.Column<Guid>(type: "uuid", nullable: true),
                    ContentHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OptimizationTheoryEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OptimizationTheoryEntity_AgentEntity_Agent",
                        column: x => x.Agent,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OptimizationTheoryEntity_OptimizationProposalEntity_Resulti~",
                        column: x => x.ResultingProposalId,
                        principalTable: "OptimizationProposalEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_OptimizationTheoryEntity_TestSuiteEntity_Suite",
                        column: x => x.Suite,
                        principalTable: "TestSuiteEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationTheoryEntity_Agent",
                table: "OptimizationTheoryEntity",
                column: "Agent");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationTheoryEntity_Agent_ContentHash",
                table: "OptimizationTheoryEntity",
                columns: new[] { "Agent", "ContentHash" });

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationTheoryEntity_Kind",
                table: "OptimizationTheoryEntity",
                column: "Kind");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationTheoryEntity_ResultingProposalId",
                table: "OptimizationTheoryEntity",
                column: "ResultingProposalId");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationTheoryEntity_Status",
                table: "OptimizationTheoryEntity",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationTheoryEntity_Suite",
                table: "OptimizationTheoryEntity",
                column: "Suite");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OptimizationTheoryEntity");
        }
    }
}
