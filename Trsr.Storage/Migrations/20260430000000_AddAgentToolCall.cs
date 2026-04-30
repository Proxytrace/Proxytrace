using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentToolCall : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AgentToolCallEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AgentCallId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ToolCallId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Request = table.Column<string>(type: "TEXT", nullable: false),
                    Response = table.Column<string>(type: "TEXT", nullable: true),
                    DurationMs = table.Column<long>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
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

            migrationBuilder.CreateIndex(
                name: "IX_AgentToolCallEntity_AgentCallId",
                table: "AgentToolCallEntity",
                column: "AgentCallId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentToolCallEntity_ToolCallId",
                table: "AgentToolCallEntity",
                column: "ToolCallId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgentToolCallEntity");
        }
    }
}
