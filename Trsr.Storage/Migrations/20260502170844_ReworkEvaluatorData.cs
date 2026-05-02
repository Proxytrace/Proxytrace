using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class ReworkEvaluatorData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SystemMessage",
                table: "EvaluatorEntity");

            migrationBuilder.AddColumn<string>(
                name: "Data",
                table: "EvaluatorEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Data",
                table: "EvaluatorEntity");

            migrationBuilder.AddColumn<string>(
                name: "SystemMessage",
                table: "EvaluatorEntity",
                type: "TEXT",
                nullable: true);
        }
    }
}
