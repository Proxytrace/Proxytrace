using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddModelProviderIsArchived : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "ModelProviderEntity",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_ModelProviderEntity_IsArchived",
                table: "ModelProviderEntity",
                column: "IsArchived");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ModelProviderEntity_IsArchived",
                table: "ModelProviderEntity");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "ModelProviderEntity");
        }
    }
}
