using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddEvaluatorIsArchived : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EvaluatorEntity_Project",
                table: "EvaluatorEntity");

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "EvaluatorEntity",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluatorEntity_Project_IsArchived",
                table: "EvaluatorEntity",
                columns: new[] { "Project", "IsArchived" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EvaluatorEntity_Project_IsArchived",
                table: "EvaluatorEntity");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "EvaluatorEntity");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluatorEntity_Project",
                table: "EvaluatorEntity",
                column: "Project");
        }
    }
}
