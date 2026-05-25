using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalPassRates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "CurrentPassRate",
                table: "OptimizationProposalEntity",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "ProposedPassRate",
                table: "OptimizationProposalEntity",
                type: "REAL",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CurrentPassRate",
                table: "OptimizationProposalEntity");

            migrationBuilder.DropColumn(
                name: "ProposedPassRate",
                table: "OptimizationProposalEntity");
        }
    }
}
