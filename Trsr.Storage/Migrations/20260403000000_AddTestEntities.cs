using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddTestEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EvaluatorEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluatorEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TestCaseEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Input = table.Column<string>(type: "text", nullable: false),
                    ExpectedOutput = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestCaseEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TestSuiteEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Agent = table.Column<Guid>(type: "uuid", nullable: false),
                    Evaluator = table.Column<Guid>(type: "uuid", nullable: false),
                    TestCases = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestSuiteEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestSuiteEntity_AgentEntity_Agent",
                        column: x => x.Agent,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TestSuiteEntity_EvaluatorEntity_Evaluator",
                        column: x => x.Evaluator,
                        principalTable: "EvaluatorEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TestResultEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TestCase = table.Column<Guid>(type: "uuid", nullable: false),
                    ActualResponse = table.Column<string>(type: "text", nullable: false),
                    Evaluation = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestResultEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestResultEntity_TestCaseEntity_TestCase",
                        column: x => x.TestCase,
                        principalTable: "TestCaseEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TestRunEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Agent = table.Column<Guid>(type: "uuid", nullable: false),
                    TestResults = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRunEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestRunEntity_AgentEntity_Agent",
                        column: x => x.Agent,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluatorEntity_Kind",
                table: "EvaluatorEntity",
                column: "Kind");

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEntity_Agent",
                table: "TestSuiteEntity",
                column: "Agent");

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEntity_Evaluator",
                table: "TestSuiteEntity",
                column: "Evaluator");

            migrationBuilder.CreateIndex(
                name: "IX_TestResultEntity_TestCase",
                table: "TestResultEntity",
                column: "TestCase");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunEntity_Agent",
                table: "TestRunEntity",
                column: "Agent");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "TestRunEntity");
            migrationBuilder.DropTable(name: "TestResultEntity");
            migrationBuilder.DropTable(name: "TestSuiteEntity");
            migrationBuilder.DropTable(name: "TestCaseEntity");
            migrationBuilder.DropTable(name: "EvaluatorEntity");
        }
    }
}
