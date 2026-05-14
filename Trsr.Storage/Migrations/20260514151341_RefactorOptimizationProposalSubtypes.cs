using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class RefactorOptimizationProposalSubtypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing rows use the old ProposalDetails JSON shape; wipe before column rename
            // so we don't try to deserialize stale payloads as the new typed Data POCOs.
            migrationBuilder.Sql("DELETE FROM \"OptimizationProposalEntity\"");

            migrationBuilder.RenameColumn(
                name: "Details",
                table: "OptimizationProposalEntity",
                newName: "Data");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Data",
                table: "OptimizationProposalEntity",
                newName: "Details");
        }
    }
}
