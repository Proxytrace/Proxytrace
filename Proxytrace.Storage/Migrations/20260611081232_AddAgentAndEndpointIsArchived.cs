using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentAndEndpointIsArchived : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ModelEndpointEntity_Provider",
                table: "ModelEndpointEntity");

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "ModelEndpointEntity",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "AgentEntity",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_ModelEndpointEntity_Provider_IsArchived",
                table: "ModelEndpointEntity",
                columns: new[] { "Provider", "IsArchived" });

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Project_IsArchived",
                table: "AgentEntity",
                columns: new[] { "Project", "IsArchived" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ModelEndpointEntity_Provider_IsArchived",
                table: "ModelEndpointEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Project_IsArchived",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "ModelEndpointEntity");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "AgentEntity");

            migrationBuilder.CreateIndex(
                name: "IX_ModelEndpointEntity_Provider",
                table: "ModelEndpointEntity",
                column: "Provider");
        }
    }
}
