#nullable disable

using Microsoft.EntityFrameworkCore.Migrations;

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectSearchSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProjectSearchSettingsEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Project = table.Column<Guid>(type: "TEXT", nullable: false),
                    Enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    IndexedKinds = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    AutoReindexOnChange = table.Column<bool>(type: "INTEGER", nullable: false),
                    SnippetLength = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectSearchSettingsEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectSearchSettingsEntity_ProjectEntity_Project",
                        column: x => x.Project,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectSearchSettingsEntity_Project",
                table: "ProjectSearchSettingsEntity",
                column: "Project",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectSearchSettingsEntity");
        }
    }
}
