using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddEvaluationStatProjection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EvaluationStatEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TestResultId = table.Column<Guid>(type: "uuid", nullable: false),
                    EvaluatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Score = table.Column<byte>(type: "smallint", nullable: true),
                    HasError = table.Column<bool>(type: "boolean", nullable: false),
                    InputTokens = table.Column<long>(type: "bigint", nullable: true),
                    OutputTokens = table.Column<long>(type: "bigint", nullable: true),
                    CachedInputTokens = table.Column<long>(type: "bigint", nullable: true),
                    LatencyMicroseconds = table.Column<long>(type: "bigint", nullable: false),
                    Cost = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationStatEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationStatEntity_TestResultEntity_TestResultId",
                        column: x => x.TestResultId,
                        principalTable: "TestResultEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationStatEntity_EvaluatorId_CreatedAt",
                table: "EvaluationStatEntity",
                columns: new[] { "EvaluatorId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationStatEntity_TestResultId",
                table: "EvaluationStatEntity",
                column: "TestResultId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvaluationStatEntity");
        }
    }
}
