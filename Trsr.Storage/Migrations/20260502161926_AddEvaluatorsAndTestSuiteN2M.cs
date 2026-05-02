using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddEvaluatorsAndTestSuiteN2M : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestSuiteEntity_EvaluatorEntity_Evaluator",
                table: "TestSuiteEntity");

            migrationBuilder.DropIndex(
                name: "IX_TestSuiteEntity_Evaluator",
                table: "TestSuiteEntity");

            migrationBuilder.DropColumn(
                name: "Evaluator",
                table: "TestSuiteEntity");

            migrationBuilder.DropColumn(
                name: "Evaluation",
                table: "TestResultEntity");

            migrationBuilder.AddColumn<string>(
                name: "Evaluations",
                table: "TestResultEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SystemMessage",
                table: "EvaluatorEntity",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TestSuiteEvaluatorEntity",
                columns: table => new
                {
                    TestSuiteId = table.Column<Guid>(type: "TEXT", nullable: false),
                    EvaluatorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TestSuiteEntityId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestSuiteEvaluatorEntity", x => new { x.TestSuiteId, x.EvaluatorId });
                    table.ForeignKey(
                        name: "FK_TestSuiteEvaluatorEntity_EvaluatorEntity_EvaluatorId",
                        column: x => x.EvaluatorId,
                        principalTable: "EvaluatorEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TestSuiteEvaluatorEntity_TestSuiteEntity_TestSuiteEntityId",
                        column: x => x.TestSuiteEntityId,
                        principalTable: "TestSuiteEntity",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TestSuiteEvaluatorEntity_TestSuiteEntity_TestSuiteId",
                        column: x => x.TestSuiteId,
                        principalTable: "TestSuiteEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEvaluatorEntity_EvaluatorId",
                table: "TestSuiteEvaluatorEntity",
                column: "EvaluatorId");

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEvaluatorEntity_TestSuiteEntityId",
                table: "TestSuiteEvaluatorEntity",
                column: "TestSuiteEntityId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TestSuiteEvaluatorEntity");

            migrationBuilder.DropColumn(
                name: "Evaluations",
                table: "TestResultEntity");

            migrationBuilder.DropColumn(
                name: "SystemMessage",
                table: "EvaluatorEntity");

            migrationBuilder.AddColumn<Guid>(
                name: "Evaluator",
                table: "TestSuiteEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "Evaluation",
                table: "TestResultEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEntity_Evaluator",
                table: "TestSuiteEntity",
                column: "Evaluator");

            migrationBuilder.AddForeignKey(
                name: "FK_TestSuiteEntity_EvaluatorEntity_Evaluator",
                table: "TestSuiteEntity",
                column: "Evaluator",
                principalTable: "EvaluatorEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
