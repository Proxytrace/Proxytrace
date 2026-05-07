using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemEndpoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SystemMessage",
                table: "AgentEntity",
                newName: "SystemPrompt");

            migrationBuilder.AddColumn<Guid>(
                name: "SystemEndpoint",
                table: "ProjectEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<bool>(
                name: "IsSystemAgent",
                table: "AgentEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEntity_SystemEndpoint",
                table: "ProjectEntity",
                column: "SystemEndpoint");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectEntity_ModelEndpointEntity_SystemEndpoint",
                table: "ProjectEntity",
                column: "SystemEndpoint",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectEntity_ModelEndpointEntity_SystemEndpoint",
                table: "ProjectEntity");

            migrationBuilder.DropIndex(
                name: "IX_ProjectEntity_SystemEndpoint",
                table: "ProjectEntity");

            migrationBuilder.DropColumn(
                name: "SystemEndpoint",
                table: "ProjectEntity");

            migrationBuilder.DropColumn(
                name: "IsSystemAgent",
                table: "AgentEntity");

            migrationBuilder.RenameColumn(
                name: "SystemPrompt",
                table: "AgentEntity",
                newName: "SystemMessage");
        }
    }
}
