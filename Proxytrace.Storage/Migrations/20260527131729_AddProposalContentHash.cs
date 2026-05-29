using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalContentHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContentHash",
                table: "OptimizationProposalEntity",
                type: "TEXT",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Agent_ContentHash",
                table: "OptimizationProposalEntity",
                columns: new[] { "Agent", "ContentHash" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OptimizationProposalEntity_Agent_ContentHash",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropColumn(
                name: "ContentHash",
                table: "OptimizationProposalEntity");
        }
    }
}
