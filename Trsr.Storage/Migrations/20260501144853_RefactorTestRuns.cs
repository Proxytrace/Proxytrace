using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class RefactorTestRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_AgentEntity_Agent",
                table: "TestRunEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_TestSuiteEntity_Suite",
                table: "TestRunEntity");

            migrationBuilder.DropIndex(
                name: "IX_TestRunEntity_Agent",
                table: "TestRunEntity");

            migrationBuilder.DropColumn(
                name: "Agent",
                table: "TestRunEntity");

            migrationBuilder.RenameColumn(
                name: "Timestamp",
                table: "TestRunEntity",
                newName: "Endpoint");

            migrationBuilder.AlterColumn<Guid>(
                name: "Suite",
                table: "TestRunEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TestRunEntity_Endpoint",
                table: "TestRunEntity",
                column: "Endpoint");

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_ModelEndpointEntity_Endpoint",
                table: "TestRunEntity",
                column: "Endpoint",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_TestSuiteEntity_Suite",
                table: "TestRunEntity",
                column: "Suite",
                principalTable: "TestSuiteEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_ModelEndpointEntity_Endpoint",
                table: "TestRunEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_TestSuiteEntity_Suite",
                table: "TestRunEntity");

            migrationBuilder.DropIndex(
                name: "IX_TestRunEntity_Endpoint",
                table: "TestRunEntity");

            migrationBuilder.RenameColumn(
                name: "Endpoint",
                table: "TestRunEntity",
                newName: "Timestamp");

            migrationBuilder.AlterColumn<Guid>(
                name: "Suite",
                table: "TestRunEntity",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "TEXT");

            migrationBuilder.AddColumn<Guid>(
                name: "Agent",
                table: "TestRunEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_TestRunEntity_Agent",
                table: "TestRunEntity",
                column: "Agent");

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_AgentEntity_Agent",
                table: "TestRunEntity",
                column: "Agent",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_TestSuiteEntity_Suite",
                table: "TestRunEntity",
                column: "Suite",
                principalTable: "TestSuiteEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
