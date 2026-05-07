using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAgentToolCall : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ModelProviderEntity_OrganizationEntity_Organization",
                table: "ModelProviderEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectEntity_OrganizationEntity_Organization",
                table: "ProjectEntity");

            migrationBuilder.DropTable(
                name: "AgentToolCallEntity");

            migrationBuilder.DropTable(
                name: "OrganizationUserEntity");

            migrationBuilder.DropTable(
                name: "OrganizationEntity");

            migrationBuilder.DropIndex(
                name: "IX_ProjectEntity_Name_Organization",
                table: "ProjectEntity");

            migrationBuilder.DropIndex(
                name: "IX_ProjectEntity_Organization",
                table: "ProjectEntity");

            migrationBuilder.DropIndex(
                name: "IX_ModelProviderEntity_Organization",
                table: "ModelProviderEntity");

            migrationBuilder.DropColumn(
                name: "Organization",
                table: "ProjectEntity");

            migrationBuilder.DropColumn(
                name: "Organization",
                table: "ModelProviderEntity");

            migrationBuilder.DropColumn(
                name: "DurationMs",
                table: "AgentCallEntity");

            migrationBuilder.AddColumn<Guid>(
                name: "Project",
                table: "EvaluatorEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<string>(
                name: "Response",
                table: "AgentCallEntity",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AlterColumn<ulong>(
                name: "OutputTokens",
                table: "AgentCallEntity",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AlterColumn<ulong>(
                name: "InputTokens",
                table: "AgentCallEntity",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AddColumn<double>(
                name: "LatencyMs",
                table: "AgentCallEntity",
                type: "REAL",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEntity_Name",
                table: "ProjectEntity",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProjectEntity_Name",
                table: "ProjectEntity");

            migrationBuilder.DropColumn(
                name: "Project",
                table: "EvaluatorEntity");

            migrationBuilder.DropColumn(
                name: "LatencyMs",
                table: "AgentCallEntity");

            migrationBuilder.AddColumn<Guid>(
                name: "Organization",
                table: "ProjectEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Organization",
                table: "ModelProviderEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<string>(
                name: "Response",
                table: "AgentCallEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "OutputTokens",
                table: "AgentCallEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(ulong),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "InputTokens",
                table: "AgentCallEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(ulong),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DurationMs",
                table: "AgentCallEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "AgentToolCallEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AgentCallId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    DurationMs = table.Column<long>(type: "INTEGER", nullable: true),
                    Request = table.Column<string>(type: "TEXT", nullable: false),
                    Response = table.Column<string>(type: "TEXT", nullable: true),
                    ToolCallId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentToolCallEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentToolCallEntity_AgentCallEntity_AgentCallId",
                        column: x => x.AgentCallId,
                        principalTable: "AgentCallEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationUserEntity",
                columns: table => new
                {
                    OrganizationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizationEntityId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationUserEntity", x => new { x.OrganizationId, x.UserId });
                    table.ForeignKey(
                        name: "FK_OrganizationUserEntity_OrganizationEntity_OrganizationEntityId",
                        column: x => x.OrganizationEntityId,
                        principalTable: "OrganizationEntity",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrganizationUserEntity_OrganizationEntity_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "OrganizationEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrganizationUserEntity_UserEntity_UserId",
                        column: x => x.UserId,
                        principalTable: "UserEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEntity_Name_Organization",
                table: "ProjectEntity",
                columns: new[] { "Name", "Organization" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEntity_Organization",
                table: "ProjectEntity",
                column: "Organization");

            migrationBuilder.CreateIndex(
                name: "IX_ModelProviderEntity_Organization",
                table: "ModelProviderEntity",
                column: "Organization");

            migrationBuilder.CreateIndex(
                name: "IX_AgentToolCallEntity_AgentCallId",
                table: "AgentToolCallEntity",
                column: "AgentCallId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentToolCallEntity_ToolCallId",
                table: "AgentToolCallEntity",
                column: "ToolCallId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationEntity_Name",
                table: "OrganizationEntity",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationUserEntity_OrganizationEntityId",
                table: "OrganizationUserEntity",
                column: "OrganizationEntityId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationUserEntity_UserId",
                table: "OrganizationUserEntity",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ModelProviderEntity_OrganizationEntity_Organization",
                table: "ModelProviderEntity",
                column: "Organization",
                principalTable: "OrganizationEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectEntity_OrganizationEntity_Organization",
                table: "ProjectEntity",
                column: "Organization",
                principalTable: "OrganizationEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
