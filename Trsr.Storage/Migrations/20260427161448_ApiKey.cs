using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class ApiKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ApiKeyEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Project = table.Column<Guid>(type: "TEXT", nullable: false),
                    Provider = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiKeyEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApiKeyEntity_ModelProviderEntity_Provider",
                        column: x => x.Provider,
                        principalTable: "ModelProviderEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApiKeyEntity_ProjectEntity_Project",
                        column: x => x.Project,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_ApiKey",
                table: "ApiKeyEntity",
                column: "ApiKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_Project",
                table: "ApiKeyEntity",
                column: "Project");

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_Provider",
                table: "ApiKeyEntity",
                column: "Provider");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApiKeyEntity");
        }
    }
}
