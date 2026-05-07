using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddEndpointToAgent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "StatTestCases",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "StatPassed",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "OutputTokens",
                table: "TestResultEntity",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "INTEGER");

            migrationBuilder.AlterColumn<long>(
                name: "InputTokens",
                table: "TestResultEntity",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "INTEGER");

            migrationBuilder.AddColumn<Guid>(
                name: "Endpoint",
                table: "AgentEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Endpoint",
                table: "AgentEntity",
                column: "Endpoint");

            migrationBuilder.AddForeignKey(
                name: "FK_AgentEntity_ModelEndpointEntity_Endpoint",
                table: "AgentEntity",
                column: "Endpoint",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentEntity_ModelEndpointEntity_Endpoint",
                table: "AgentEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Endpoint",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "Endpoint",
                table: "AgentEntity");

            migrationBuilder.AlterColumn<int>(
                name: "StatTestCases",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AlterColumn<int>(
                name: "StatPassed",
                table: "TestRunEntity",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AlterColumn<long>(
                name: "OutputTokens",
                table: "TestResultEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "InputTokens",
                table: "TestResultEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "INTEGER",
                oldNullable: true);
        }
    }
}
