using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddApiKeyOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // API keys gain a required owner (IUser). There is no sensible owner to backfill onto
            // pre-existing keys, so — current installations being test-only — clear them; admins
            // re-mint keys with an owner. (Removes the rows before the non-null FK column is added.)
            migrationBuilder.Sql("DELETE FROM \"ApiKeyEntity\";");

            migrationBuilder.AddColumn<Guid>(
                name: "Owner",
                table: "ApiKeyEntity",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_Owner",
                table: "ApiKeyEntity",
                column: "Owner");

            migrationBuilder.AddForeignKey(
                name: "FK_ApiKeyEntity_UserEntity_Owner",
                table: "ApiKeyEntity",
                column: "Owner",
                principalTable: "UserEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ApiKeyEntity_UserEntity_Owner",
                table: "ApiKeyEntity");

            migrationBuilder.DropIndex(
                name: "IX_ApiKeyEntity_Owner",
                table: "ApiKeyEntity");

            migrationBuilder.DropColumn(
                name: "Owner",
                table: "ApiKeyEntity");
        }
    }
}
