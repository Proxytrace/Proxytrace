using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddOutlierDetection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte>(
                name: "OutlierFlags",
                table: "AgentCallEntity",
                type: "smallint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.CreateTable(
                name: "OutlierSettingsEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    SigmaMultiplier = table.Column<double>(type: "double precision", nullable: false),
                    MinSampleCount = table.Column<int>(type: "integer", nullable: false),
                    SampleWindow = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutlierSettingsEntity", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_OutlierFlags",
                table: "AgentCallEntity",
                column: "OutlierFlags",
                filter: "\"OutlierFlags\" <> 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OutlierSettingsEntity");

            migrationBuilder.DropIndex(
                name: "IX_AgentCallEntity_OutlierFlags",
                table: "AgentCallEntity");

            migrationBuilder.DropColumn(
                name: "OutlierFlags",
                table: "AgentCallEntity");
        }
    }
}
