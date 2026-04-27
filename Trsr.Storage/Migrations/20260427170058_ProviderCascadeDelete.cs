using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class ProviderCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ApiKeyEntity_ModelProviderEntity_Provider",
                table: "ApiKeyEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                table: "ModelEndpointEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_ApiKeyEntity_ModelProviderEntity_Provider",
                table: "ApiKeyEntity",
                column: "Provider",
                principalTable: "ModelProviderEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                table: "ModelEndpointEntity",
                column: "Provider",
                principalTable: "ModelProviderEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ApiKeyEntity_ModelProviderEntity_Provider",
                table: "ApiKeyEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                table: "ModelEndpointEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_ApiKeyEntity_ModelProviderEntity_Provider",
                table: "ApiKeyEntity",
                column: "Provider",
                principalTable: "ModelProviderEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                table: "ModelEndpointEntity",
                column: "Provider",
                principalTable: "ModelProviderEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
