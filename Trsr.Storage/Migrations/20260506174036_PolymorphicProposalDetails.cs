using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class PolymorphicProposalDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProposedSystemMessage",
                table: "OptimizationProposalEntity");

            migrationBuilder.RenameColumn(
                name: "ProposedTools",
                table: "OptimizationProposalEntity",
                newName: "Details");

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "OptimizationProposalEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Kind",
                table: "OptimizationProposalEntity",
                column: "Kind");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OptimizationProposalEntity_Kind",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "OptimizationProposalEntity");

            migrationBuilder.RenameColumn(
                name: "Details",
                table: "OptimizationProposalEntity",
                newName: "ProposedTools");

            migrationBuilder.AddColumn<string>(
                name: "ProposedSystemMessage",
                table: "OptimizationProposalEntity",
                type: "TEXT",
                nullable: true);
        }
    }
}
