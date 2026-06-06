using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddTheoryValidationMetrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "BaselinePassRate",
                table: "OptimizationTheoryEntity",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "PValue",
                table: "OptimizationTheoryEntity",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "ProjectedPassRate",
                table: "OptimizationTheoryEntity",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BaselinePassRate",
                table: "OptimizationTheoryEntity");

            migrationBuilder.DropColumn(
                name: "PValue",
                table: "OptimizationTheoryEntity");

            migrationBuilder.DropColumn(
                name: "ProjectedPassRate",
                table: "OptimizationTheoryEntity");
        }
    }
}
