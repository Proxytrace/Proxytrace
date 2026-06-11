using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentAndEvaluatorProjectIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Project",
                table: "AgentEntity");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluatorEntity_Project",
                table: "EvaluatorEntity",
                column: "Project");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Project_Name",
                table: "AgentEntity",
                columns: new[] { "Project", "Name" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EvaluatorEntity_Project",
                table: "EvaluatorEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Project_Name",
                table: "AgentEntity");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Project",
                table: "AgentEntity",
                column: "Project");
        }
    }
}
