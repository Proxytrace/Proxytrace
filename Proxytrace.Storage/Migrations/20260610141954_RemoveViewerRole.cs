using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class RemoveViewerRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The Viewer role (stored as 0) was removed; UserRole now starts at Member = 1.
            // Remap any existing Viewer rows to Member so they map to a defined enum value.
            migrationBuilder.Sql("UPDATE \"UserEntity\" SET \"Role\" = 1 WHERE \"Role\" = 0;");
            migrationBuilder.Sql("UPDATE \"InviteEntity\" SET \"Role\" = 1 WHERE \"Role\" = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Irreversible: the original Viewer/Member distinction cannot be reconstructed.
        }
    }
}
