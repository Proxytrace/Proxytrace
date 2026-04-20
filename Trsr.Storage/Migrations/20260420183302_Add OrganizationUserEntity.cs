using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationUserEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrganizationUserEntity",
                columns: table => new
                {
                    OrganizationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizationEntityId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationUserEntity", x => new { x.OrganizationId, x.UserId });
                    table.ForeignKey(
                        name: "FK_OrganizationUserEntity_OrganizationEntity_OrganizationEntityId",
                        column: x => x.OrganizationEntityId,
                        principalTable: "OrganizationEntity",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrganizationUserEntity_OrganizationEntity_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "OrganizationEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrganizationUserEntity_UserEntity_UserId",
                        column: x => x.UserId,
                        principalTable: "UserEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationUserEntity_OrganizationEntityId",
                table: "OrganizationUserEntity",
                column: "OrganizationEntityId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationUserEntity_UserId",
                table: "OrganizationUserEntity",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationUserEntity");
        }
    }
}
