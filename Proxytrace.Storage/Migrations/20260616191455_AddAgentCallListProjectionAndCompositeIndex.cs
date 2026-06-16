using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentCallListProjectionAndCompositeIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_AgentVersionId",
                table: "AgentCallEntity");

            migrationBuilder.AddColumn<string>(
                name: "RequestPreview",
                table: "AgentCallEntity",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ResponseToolRequestCount",
                table: "AgentCallEntity",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_AgentVersionId_CreatedAt",
                table: "AgentCallEntity",
                columns: new[] { "AgentVersionId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_AgentVersionId_CreatedAt",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "RequestPreview",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "ResponseToolRequestCount",
                table: "AgentCallEntity");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_AgentVersionId",
                table: "AgentCallEntity",
                column: "AgentVersionId");
        }
    }
}
