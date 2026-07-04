using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentCallTool : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AgentCallToolEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentCallId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToolName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentCallToolEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentCallToolEntity_AgentCallEntity_AgentCallId",
                        column: x => x.AgentCallId,
                        principalTable: "AgentCallEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallToolEntity_AgentCallId",
                table: "AgentCallToolEntity",
                column: "AgentCallId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallToolEntity_ProjectId_ToolName",
                table: "AgentCallToolEntity",
                columns: new[] { "ProjectId", "ToolName" });

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallToolEntity_ToolName_AgentCallId",
                table: "AgentCallToolEntity",
                columns: new[] { "ToolName", "AgentCallId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgentCallToolEntity");
        }
    }
}
