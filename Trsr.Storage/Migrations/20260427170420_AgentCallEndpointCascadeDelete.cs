using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AgentCallEndpointCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity",
                column: "EndpointId",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity",
                column: "EndpointId",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
