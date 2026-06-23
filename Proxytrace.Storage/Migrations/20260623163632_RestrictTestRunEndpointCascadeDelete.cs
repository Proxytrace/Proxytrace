using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class RestrictTestRunEndpointCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_ModelEndpointEntity_Endpoint",
                table: "TestRunEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_ModelEndpointEntity_Endpoint",
                table: "TestRunEntity",
                column: "Endpoint",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_ModelEndpointEntity_Endpoint",
                table: "TestRunEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_ModelEndpointEntity_Endpoint",
                table: "TestRunEntity",
                column: "Endpoint",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
