using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class FixTestSuiteEvaluatorRelation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestSuiteEvaluatorEntity_TestSuiteEntity_TestSuiteEntityId",
                table: "TestSuiteEvaluatorEntity");

            migrationBuilder.DropIndex(
                name: "IX_TestSuiteEvaluatorEntity_TestSuiteEntityId",
                table: "TestSuiteEvaluatorEntity");

            migrationBuilder.DropColumn(
                name: "TestSuiteEntityId",
                table: "TestSuiteEvaluatorEntity");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TestSuiteEntityId",
                table: "TestSuiteEvaluatorEntity",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEvaluatorEntity_TestSuiteEntityId",
                table: "TestSuiteEvaluatorEntity",
                column: "TestSuiteEntityId");

            migrationBuilder.AddForeignKey(
                name: "FK_TestSuiteEvaluatorEntity_TestSuiteEntity_TestSuiteEntityId",
                table: "TestSuiteEvaluatorEntity",
                column: "TestSuiteEntityId",
                principalTable: "TestSuiteEntity",
                principalColumn: "Id");
        }
    }
}
