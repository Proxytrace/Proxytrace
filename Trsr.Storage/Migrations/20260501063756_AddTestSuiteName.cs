using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddTestSuiteName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "TestSuiteEntity",
                type: "TEXT",
                nullable: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Name",
                table: "TestSuiteEntity");
        }
    }
}
