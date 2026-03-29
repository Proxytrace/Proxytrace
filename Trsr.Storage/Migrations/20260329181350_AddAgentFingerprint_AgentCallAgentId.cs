using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentFingerprint_AgentCallAgentId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentEntity_ProjectEntity_Project",
                table: "AgentEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Project",
                table: "AgentEntity");

            migrationBuilder.RenameColumn(
                name: "ConversationJson",
                table: "AgentCallEntity",
                newName: "ResponseJson");

            migrationBuilder.RenameColumn(
                name: "AgentMessageJson",
                table: "AgentCallEntity",
                newName: "RequestJson");

            migrationBuilder.AlterColumn<Guid>(
                name: "Project",
                table: "AgentEntity",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "Fingerprint",
                table: "AgentEntity",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "AgentId",
                table: "AgentCallEntity",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Fingerprint",
                table: "AgentEntity",
                column: "Fingerprint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_AgentId",
                table: "AgentCallEntity",
                column: "AgentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Fingerprint",
                table: "AgentEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_AgentId",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "Fingerprint",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "AgentId",
                table: "AgentCallEntity");

            migrationBuilder.RenameColumn(
                name: "ResponseJson",
                table: "AgentCallEntity",
                newName: "ConversationJson");

            migrationBuilder.RenameColumn(
                name: "RequestJson",
                table: "AgentCallEntity",
                newName: "AgentMessageJson");

            migrationBuilder.AlterColumn<Guid>(
                name: "Project",
                table: "AgentEntity",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Project",
                table: "AgentEntity",
                column: "Project");

            migrationBuilder.AddForeignKey(
                name: "FK_AgentEntity_ProjectEntity_Project",
                table: "AgentEntity",
                column: "Project",
                principalTable: "ProjectEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
