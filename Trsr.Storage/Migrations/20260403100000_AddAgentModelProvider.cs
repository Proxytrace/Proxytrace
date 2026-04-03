using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentModelProvider : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "AgentEntity",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "AgentEntity",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Model",
                table: "AgentEntity",
                column: "Model");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Provider",
                table: "AgentEntity",
                column: "Provider");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Model",
                table: "AgentEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Provider",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "Provider",
                table: "AgentEntity");
        }
    }
}
