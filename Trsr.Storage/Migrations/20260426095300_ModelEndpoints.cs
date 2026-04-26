using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class ModelEndpoints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Model",
                table: "AgentEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentEntity_Provider",
                table: "AgentEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_Model",
                table: "AgentCallEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_Provider",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "Provider",
                table: "AgentEntity");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "Provider",
                table: "AgentCallEntity");

            migrationBuilder.AlterColumn<Guid>(
                name: "AgentId",
                table: "AgentCallEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EndpointId",
                table: "AgentCallEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "ModelEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelProviderEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Endpoint = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelProviderEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelEndpointEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Model = table.Column<Guid>(type: "TEXT", nullable: false),
                    Provider = table.Column<Guid>(type: "TEXT", nullable: false),
                    InputTokenCost = table.Column<decimal>(type: "TEXT", precision: 18, scale: 6, nullable: false),
                    OutputTokenCost = table.Column<decimal>(type: "TEXT", precision: 18, scale: 6, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelEndpointEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModelEndpointEntity_ModelEntity_Model",
                        column: x => x.Model,
                        principalTable: "ModelEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                        column: x => x.Provider,
                        principalTable: "ModelProviderEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_EndpointId",
                table: "AgentCallEntity",
                column: "EndpointId");

            migrationBuilder.CreateIndex(
                name: "IX_ModelEndpointEntity_Model_Provider",
                table: "ModelEndpointEntity",
                columns: new[] { "Model", "Provider" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModelEndpointEntity_Provider",
                table: "ModelEndpointEntity",
                column: "Provider");

            migrationBuilder.CreateIndex(
                name: "IX_ModelEntity_Name",
                table: "ModelEntity",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModelProviderEntity_Name",
                table: "ModelProviderEntity",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity",
                column: "EndpointId",
                principalTable: "ModelEndpointEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                table: "AgentCallEntity");

            migrationBuilder.DropTable(
                name: "ModelEndpointEntity");

            migrationBuilder.DropTable(
                name: "ModelEntity");

            migrationBuilder.DropTable(
                name: "ModelProviderEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_EndpointId",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "EndpointId",
                table: "AgentCallEntity");

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "AgentEntity",
                type: "TEXT",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "AgentEntity",
                type: "TEXT",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<Guid>(
                name: "AgentId",
                table: "AgentCallEntity",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "TEXT");

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "AgentCallEntity",
                type: "TEXT",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "AgentCallEntity",
                type: "TEXT",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Model",
                table: "AgentEntity",
                column: "Model");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Provider",
                table: "AgentEntity",
                column: "Provider");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_Model",
                table: "AgentCallEntity",
                column: "Model");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_Provider",
                table: "AgentCallEntity",
                column: "Provider");
        }
    }
}
