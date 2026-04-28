using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class MakeModelEndpointCostsNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "OutputTokenCost",
                table: "ModelEndpointEntity",
                type: "TEXT",
                precision: 18,
                scale: 6,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "TEXT",
                oldPrecision: 18,
                oldScale: 6);

            migrationBuilder.AlterColumn<decimal>(
                name: "InputTokenCost",
                table: "ModelEndpointEntity",
                type: "TEXT",
                precision: 18,
                scale: 6,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "TEXT",
                oldPrecision: 18,
                oldScale: 6);

            // Clear the old placeholder value (0.000001) so existing auto-discovered endpoints show no cost
            migrationBuilder.Sql(
                "UPDATE ModelEndpointEntity SET InputTokenCost = NULL WHERE InputTokenCost = 0.000001");
            migrationBuilder.Sql(
                "UPDATE ModelEndpointEntity SET OutputTokenCost = NULL WHERE OutputTokenCost = 0.000001");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "OutputTokenCost",
                table: "ModelEndpointEntity",
                type: "TEXT",
                precision: 18,
                scale: 6,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "TEXT",
                oldPrecision: 18,
                oldScale: 6,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "InputTokenCost",
                table: "ModelEndpointEntity",
                type: "TEXT",
                precision: 18,
                scale: 6,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "TEXT",
                oldPrecision: 18,
                oldScale: 6,
                oldNullable: true);
        }
    }
}
