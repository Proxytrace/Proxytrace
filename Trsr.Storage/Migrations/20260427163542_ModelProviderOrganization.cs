using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class ModelProviderOrganization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SQLite cannot change a column's nullability, so EF rebuilds the table.
            // Existing rows get Guid.Empty as the placeholder; we backfill before re-enabling
            // FK enforcement so the constraint is never violated.
            migrationBuilder.Sql("PRAGMA foreign_keys = OFF;", suppressTransaction: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Organization",
                table: "ModelProviderEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Assign any un-backfilled rows to the first organization in the database.
            // On a fresh database there are no rows yet, so this is a no-op.
            migrationBuilder.Sql("""
                UPDATE ModelProviderEntity
                SET Organization = (SELECT Id FROM OrganizationEntity LIMIT 1)
                WHERE Organization = '00000000-0000-0000-0000-000000000000';
                """);

            migrationBuilder.Sql("PRAGMA foreign_keys = ON;", suppressTransaction: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModelProviderEntity_Organization",
                table: "ModelProviderEntity",
                column: "Organization");

            migrationBuilder.AddForeignKey(
                name: "FK_ModelProviderEntity_OrganizationEntity_Organization",
                table: "ModelProviderEntity",
                column: "Organization",
                principalTable: "OrganizationEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ModelProviderEntity_OrganizationEntity_Organization",
                table: "ModelProviderEntity");

            migrationBuilder.DropIndex(
                name: "IX_ModelProviderEntity_Organization",
                table: "ModelProviderEntity");

            migrationBuilder.DropColumn(
                name: "Organization",
                table: "ModelProviderEntity");
        }
    }
}
