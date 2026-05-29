using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentVersions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentCallEntity_AgentEntity_AgentId",
                table: "AgentCallEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Fingerprint",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "Fingerprint",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "SystemPrompt",
                table: "AgentEntity");

            migrationBuilder.RenameColumn(
                name: "Tools",
                table: "AgentEntity",
                newName: "CurrentVersionId");

            migrationBuilder.RenameColumn(
                name: "AgentId",
                table: "AgentCallEntity",
                newName: "AgentVersionId");

            migrationBuilder.RenameIndex(
                name: "IX_AgentCallEntity_AgentId",
                table: "AgentCallEntity",
                newName: "IX_AgentCallEntity_AgentVersionId");

            migrationBuilder.CreateTable(
                name: "AgentVersionEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AgentId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Project = table.Column<Guid>(type: "TEXT", nullable: false),
                    VersionNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    SystemPrompt = table.Column<string>(type: "TEXT", nullable: false),
                    Tools = table.Column<string>(type: "TEXT", nullable: false),
                    Fingerprint = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    LooseFingerprint = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentVersionEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentVersionEntity_AgentEntity_AgentId",
                        column: x => x.AgentId,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AgentVersionEntity_ProjectEntity_Project",
                        column: x => x.Project,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentVersionEntity_AgentId",
                table: "AgentVersionEntity",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentVersionEntity_AgentId_VersionNumber",
                table: "AgentVersionEntity",
                columns: new[] { "AgentId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentVersionEntity_Project_Fingerprint",
                table: "AgentVersionEntity",
                columns: new[] { "Project", "Fingerprint" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentVersionEntity_Project_LooseFingerprint",
                table: "AgentVersionEntity",
                columns: new[] { "Project", "LooseFingerprint" });

            migrationBuilder.AddForeignKey(
                name: "FK_AgentCallEntity_AgentVersionEntity_AgentVersionId",
                table: "AgentCallEntity",
                column: "AgentVersionId",
                principalTable: "AgentVersionEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentCallEntity_AgentVersionEntity_AgentVersionId",
                table: "AgentCallEntity");

            migrationBuilder.DropTable(
                name: "AgentVersionEntity");

            migrationBuilder.RenameColumn(
                name: "CurrentVersionId",
                table: "AgentEntity",
                newName: "Tools");

            migrationBuilder.RenameColumn(
                name: "AgentVersionId",
                table: "AgentCallEntity",
                newName: "AgentId");

            migrationBuilder.RenameIndex(
                name: "IX_AgentCallEntity_AgentVersionId",
                table: "AgentCallEntity",
                newName: "IX_AgentCallEntity_AgentId");

            migrationBuilder.AddColumn<string>(
                name: "Fingerprint",
                table: "AgentEntity",
                type: "TEXT",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SystemPrompt",
                table: "AgentEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Fingerprint",
                table: "AgentEntity",
                column: "Fingerprint",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AgentCallEntity_AgentEntity_AgentId",
                table: "AgentCallEntity",
                column: "AgentId",
                principalTable: "AgentEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
