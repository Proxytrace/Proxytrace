using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class RestrictEndpointProviderCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                table: "ModelEndpointEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity",
                column: "EndpointId",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                table: "ModelEndpointEntity",
                column: "Provider",
                principalTable: "ModelProviderEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                table: "ModelEndpointEntity");

            migrationBuilder.AddForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity",
                column: "EndpointId",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                table: "ModelEndpointEntity",
                column: "Provider",
                principalTable: "ModelProviderEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
