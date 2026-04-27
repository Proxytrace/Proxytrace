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
            migrationBuilder.AddColumn<Guid>(
                name: "Organization",
                table: "ModelProviderEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

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
